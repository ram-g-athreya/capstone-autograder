'use strict';

var moment = require('moment');
var HashSet = require('hashset');
require('moment-timezone');


const EVENT_TYPES = {
    'tasks.task.create': ''
};

var request = require('request');
var BASE_URL = 'https://api.taiga.io/api/v1';

function makeRequest(data, options, cb) {
    var headers = {
        'Content-Type': 'application/json'
    };
    if(options.token) {
        headers['Authorization'] = 'Bearer ' + options.token;
    }

    return new Promise(resolve => {
        request({
            uri: options.uri,
            method: options.method,
            json: data,
            headers: headers
        }, (err, response, body) => {
            // if(cb) {
            //     cb(body);
            // }
            resolve(body);
        });
    });
}

async function login(data, cb) {
    data.type = 'normal';
    const response = await makeRequest(data, {uri: BASE_URL + '/auth', method: 'post'});
    return response.auth_token;
}

async function getTimeline(token, data, project_id, page) {
    const timeline = await makeRequest(data, {uri: BASE_URL + '/timeline/project/' + project_id + '?page=' + page, method: 'get', token: token});
    return timeline;
}

async function getTask(token, data, task_id) {
    const task = await makeRequest(data, {uri: BASE_URL + '/tasks/' + task_id, method: 'get', token: token});
    return task;
}

async function getUserStory(token, data, us_id) {
    const user_story = await makeRequest(data, {uri: BASE_URL + '/userstories/' + us_id, method: 'get', token: token});
    return user_story;
}

function create_daily_activity_array(length) {
    var result = [];
    for(var index = 0; index < length; index++) {
        result.push({
            activity_count: 0,
            activity_details: []
        });
    }
    return result;
}

function get_day_difference(date1, date2) {
    return moment(date1).diff(moment(date2), 'days');
}

module.exports = {
    getProjectActivity: async (data, start_date, end_date, slug) => {
        const token = await login(data);
        const project = await makeRequest(data, {uri: BASE_URL + '/projects/by_slug?slug=' + slug, method: 'get', token: token});
        const project_id = project.id;
        var page = 1;

        var users = {};
        var tasks = {};
        var user_stories = {};

        start_date = moment.tz(start_date, 'America/Phoenix').startOf('day');
        end_date =  moment.tz(end_date, 'America/Phoenix').endOf('day');

        var date_diff = get_day_difference(end_date, start_date) + 1;
        var exit_timeline_loop = false;

        while(true) {
            var timeline = await getTimeline(token, data, project_id, page);
            for(var index = 0; index < timeline.length; index++) {
                var created = moment(timeline[index].created);

                // need to see if timezones are proper
                // console.log(start_date, end_date, created);

                // If activity is within the time period
                if(end_date >= created && start_date <= created) {
                    if(timeline[index].data) {
                        var user = timeline[index].data.user;
                        var task = timeline[index].data.task;
                        var user_story = timeline[index].data.userstory;

                        // Add user if does not exist
                        if(user && !users[user.id] && user.name != 'GitHub') {
                            users[user.id] = {
                                username: user.username,
                                name: user.name,
                                daily_activity: create_daily_activity_array(date_diff)
                            }
                        }
                        // Ignore GitHub Activity for now
                        else if(user.name == 'GitHub') {
                            continue;
                        }

                        // Add User Story if does not exist
                        if(user_story && !user_stories[user_story.id]) {
                            var us = await getUserStory(token, data, user_story.id);
                            user_stories[user_story.id] = {
                                ref: us.ref,
                                subject: us.subject,
                                description: us.description,
                                milestone_name: us.milestone_name
                            };

                            console.log(us);
                        }

                        // Add task if it does not exist
                        if(task && !tasks[task.id]) {
                            // Additionally can flag in case task created after sprint
                            var t = await getTask(token, data, task.id);
                            tasks[task.id] = {
                                ref: t.ref,
                                subject: t.subject,
                                description: t.description,
                                status: t.status_extra_info.name,
                                user_story: t.user_story_extra_info ? t.user_story_extra_info.subject : '',
                                user_story_ref: t.user_story_extra_info ? t.user_story_extra_info.ref : ''
                            };
                        }

                        // Add activity to daily activity
                        var day_index = get_day_difference(created, start_date), target = '', changes = '';
                        users[user.id].daily_activity[day_index].activity_count += 1;

                        for(var change in timeline[index].data.values_diff) {
                            if(change != 'taskboard_order') {
                                changes += change + ': ' +  timeline[index].data.values_diff[change][0] + ' => ' + timeline[index].data.values_diff[change][1] + '<br/>';
                            }
                        }

                        // Action is a task then add it as a task
                        if(task) {
                            target = 'Task #' + task.ref + ' ' + task.subject;
                        }
                        else if(user_story) {
                            target = 'US #' + user_story.ref + ' ' + user_story.subject;
                        }

                        users[user.id].daily_activity[day_index].activity_details.push({
                            target: target,
                            event_type: timeline[index].event_type,
                            changes: changes
                        });

                        if(timeline[index].event_type == 'userstories.userstory.change') {
                            // console.log(timeline[index]);
                            // // console.log(timeline[index].data.values_diff);
                            // console.log('\n\n\n');
                        }
                    }
                }
                else if(start_date.diff(created) > 0) { // If activity is before time period then we can safely exist
                    exit_timeline_loop = true;
                    break;
                }
            }

            if (exit_timeline_loop) {
                break;
            }

            page++;
        }

        return {
            users: users,
            user_stories: user_stories,
            tasks: tasks,
            start_date: start_date
        };
    }
};