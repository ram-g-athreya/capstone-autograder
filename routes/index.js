'use strict';
var express = require('express');
var router = express.Router();
var moment = require('moment');
var HashSet = require('hashset');
require('moment-timezone');

// https://octokit.github.io/rest.js/#api-Repos-getCommits
const octokit = require('@octokit/rest')();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Capstone GitHub Autograder' });
});

function create_daily_activity_array(length) {
    var result = [];
    for(var index = 0; index < length; index++) {
        result.push({
            commits: 0,
            additions: 0,
            deletions: 0,
            total: 0,
            commit_details: []
        });
    }
    return result;
}

function get_day_difference(date1, date2) {
    return moment(date1).diff(moment(date2), 'days');
}

async function get_user_data(userid, owner, repo, start_date, end_date) {
    var date_diff = get_day_difference(end_date, start_date) + 1;
    var daily_activity = create_daily_activity_array(date_diff);
    var master_activity = {commits: 0, additions: 0, deletions: 0, total: 0};
    var total_activity = {commits: 0, additions: 0, deletions: 0, total: 0};

    var commits_hash = new HashSet();
    var user = await octokit.search.users({q: userid}), name = '';

    if(user.data.items && user.data.items[0]) {
        name = await octokit.users.getById({id: user.data.items[0].id});
        name = name.data.name;
    }

    var branches_object = await octokit.repos.getBranches({
        owner: owner,
        repo: repo,
        per_page: 100
    });

    var branches = [];
    branches_object.data.map(obj => {
        branches.push(obj.name);
    });

    branches.splice(branches.indexOf('master'), 1);
    branches.unshift('master');

    for(var branch_index = 0; branch_index < branches.length; branch_index++) {
        var commits = await octokit.repos.getCommits({
            owner: owner,
            repo: repo,
            since: start_date.toISOString(),
            until: end_date.toISOString(),
            per_page: 100,
            author: userid,
            sha: branches[branch_index]
        });

        if(commits && commits.data.length) {
            for(var commits_index = 0; commits_index < commits.data.length; commits_index++) {
                if(commits_hash.contains(commits.data[commits_index].sha)) {
                    continue;
                }

                var day_index = get_day_difference(commits.data[commits_index].commit.committer.date, start_date);
                commits_hash.add(commits.data[commits_index].sha);

                var commit = await octokit.repos.getCommit({
                    owner: owner,
                    repo: repo,
                    sha: commits.data[commits_index].sha
                });

                total_activity.commits++;
                total_activity.additions += commit.data.stats.additions;
                total_activity.deletions += commit.data.stats.deletions;
                total_activity.total += commit.data.stats.total;

                if(branches[branch_index] == 'master') {
                    master_activity.commits++;
                    master_activity.additions += commit.data.stats.additions;
                    master_activity.deletions += commit.data.stats.deletions;
                    master_activity.total += commit.data.stats.total;
                }

                daily_activity[day_index].commits++;
                daily_activity[day_index].additions += commit.data.stats.additions;
                daily_activity[day_index].deletions += commit.data.stats.deletions;
                daily_activity[day_index].total += commit.data.stats.total;

                daily_activity[day_index].commit_details.push({
                    timestamp: commit.meta['last-modified'],
                    message: commits.data[commits_index].commit.message,
                    html_url: commits.data[commits_index].html_url,
                    branch: branches[branch_index],
                    additions: commit.data.stats.additions,
                    deletions: commit.data.stats.deletions,
                    total: commit.data.stats.total
                });
            }
        }
    }

    // Calculating Inactivity Streaks
    var inactivity_streaks = [], streak_in_progress = false, streak_count = 0;
    for(var index = 0; index < daily_activity.length; index++) {
        if(!streak_in_progress) {
            if(daily_activity[index].commits == 0) {
                streak_in_progress = true;
                streak_count = 1;
            }
        }
        else {
            if(daily_activity[index].commits == 0) {
                streak_count += 1;
            }
            else {
                if(streak_count > 1) {
                    inactivity_streaks.push(streak_count);
                }
                streak_in_progress = false;
            }
        }
    }

    if(streak_in_progress && streak_count > 1) {
        inactivity_streaks.push(streak_count);
    }

    return {
        daily_activity: daily_activity,
        total_activity: total_activity,
        master_activity: master_activity,
        inactivity_streaks: inactivity_streaks,
        userid: userid,
        name: name
    };
}

async function get_data(params) {
    octokit.authenticate({
        type: 'token',
        token: params.token
    });

    var data = [];
    var start_date = moment.tz(params.start_date, 'America/Phoenix').startOf('day');
    var end_date =  moment.tz(params.end_date, 'America/Phoenix').endOf('day');

    var userids = params.userids.split(',');
    for(var index = 0; index < userids.length; index++) {
        var user_data = await get_user_data(userids[index], params.owner, params.repo, start_date, end_date);
        data.push(user_data);
    }
    return {data: data, start_date: start_date};
}

router.post('/', async (req, res, next) => {
    res.render('github_stats', await get_data(req.body));
});

/**
 * @api {get} /github-stats Get GitHub Stats
 * @apiName GitHub Stats
 * @apiGroup GitHub
 * @apiDescription Get the GitHub activity for a group of users who contributed to the same repository for a given time period.
 * The API returns an array of objects. Each object specifies the stats for one user. For detailed information of the user object please check the Success 200 section.
 *
 * @apiParam {String} token GitHub Access Token which has oAuth permissions to access the repository's data
 * @apiParam {Date} start_date Start Date from which data must be pulled for consideration. Please note that the TimeZone is assumed to be Phoenix on the server side.
 * @apiParam {Date} end_date End Date upto which data must be pulled for consideration. Please note that the TimeZone is assumed to be Phoenix on the server side.
 * @apiParam {String} owner Repository Owner's GitHub ID
 * @apiParam {String} repo Repository Name in GitHub
 * @apiParam {String} userids URL Encoded and Comma Separated GitHub User IDs of the Students. For example, if the GitHub IDs are carmstr7 and david-henderson then carmstr7%2Cdavid-henderson must be passed
 *
 *
 * @apiSuccess {String} userid GitHub User ID of the student
 * @apiSuccess {String} name GitHub Name of the student. Please note sometimes this could be blank
 *
 * @apiSuccess {Object} total_activity Total Activity of the student for the given period
 * @apiSuccess {Number} total_activity.commits Total Commits for the period
 * @apiSuccess {Number} total_activity.additions Total Additions for the period
 * @apiSuccess {Number} total_activity.deletions Total Deletions for the period
 * @apiSuccess {Number} total_activity.total Total changes for the period
 *
 *
 * @apiSuccess {Object} master_activity Total Activity of the student for the given period in Master Branch
 * @apiSuccess {Number} master_activity.commits Total Commits for the period in Master Branch
 * @apiSuccess {Number} master_activity.additions Total Additions for the period in Master Branch
 * @apiSuccess {Number} master_activity.deletions Total Deletions for the period in Master Branch
 * @apiSuccess {Number} master_activity.total Total changes for the period in Master Branch
 *
 *
 * @apiSuccess {Object} master_activity Master Activity of the student for the given period
 *
 * @apiSuccess {Array} daily_activity Activity Stats for a given day returned as an Array of Objects. Please note index 0 implies the start_date and the final index implies the end_date
 * @apiSuccess {Number} daily_activity.commits Commits on that day
 * @apiSuccess {Number} daily_activity.additions Additions on that day
 * @apiSuccess {Number} daily_activity.deletions Deletions on that day
 * @apiSuccess {Number} daily_activity.total Total changes on that day
 * @apiSuccess {Array} daily_activity.commit_details Detailed information of commits for that day returned as an Array of Objects. Please note this can be empty if there were no commits for that day
 *
 * @apiSuccess {Timestamp} daily_activity.commit_details.timestamp Timestamp of commit
 * @apiSuccess {String} daily_activity.commit_details.message Commit message
 * @apiSuccess {URL} daily_activity.commit_details.html_url HTML URL of the commit
 * @apiSuccess {String} daily_activity.commit_details.branch Branch in which the commit happened. If the same commit is made in another branch and merged into master then ONLY master is considered and returned.
 * @apiSuccess {Number} daily_activity.commit_details.additions Additions made on that commit
 * @apiSuccess {Number} daily_activity.commit_details.deletions Deletions made on that commit
 * @apiSuccess {Number} daily_activity.commit_details.total Total changes made on that commit
 *
 * @apiSuccess {Array} inactivity_streaks Array representing periods of inactivity. For example, in a two week period if a student is inactive for first five days and last two days then the value would be [5, 2]. For a period to be considered as an inactivity streak, the student must not have activity for at least 2 consecutive days. So if he/she shows progress on alternate days then the value would be an empty array [].
 *
 *
 * @apiParamExample Request-Example:
 * /github-stats?token=<github-token>&start_date=2018-03-09&end_date=2018-03-22&owner=david-henderson&repo=ser517-travlendar&userids=carmstr7%2Cdavid-henderson
 *
 * @apiSuccessExample Success-Response:
 * [
 {
     "userid": "carmstr7",
     "name": "Cephas Armstrong-Mensah",
     "daily_activity": [
         {
             "commits": 0,
             "additions": 0,
             "deletions": 0,
             "total": 0,
             "commit_details": []
         },
         {
             "commits": 6,
             "additions": 432,
             "deletions": 241,
             "total": 673,
             "commit_details": [
                 {
                     "timestamp": "Sat, 17 Mar 2018 04:08:04 GMT",
                     "message": "TG-162 remove save method, only delete is using it, so just saved in delete",
                     "html_url": "https://github.com/david-henderson/ser517-travlendar/commit/81d1cf02af3cc874f6c000f7d924376e3045369d",
                     "branch": "master",
                     "additions": 1,
                     "deletions": 9,
                     "total": 10
                 },
                 {
                     "timestamp": "Sat, 17 Mar 2018 04:02:18 GMT",
                     "message": "TG-162 #in-progress, adding in deleteTravelEvent in travel.js",
                     "html_url": "https://github.com/david-henderson/ser517-travlendar/commit/b125fa1bc7bbd9498ae7308648aa52e2b84b87fd",
                     "branch": "master",
                     "additions": 69,
                     "deletions": 83,
                     "total": 152
                 },
                 {
                     "timestamp": "Sat, 17 Mar 2018 03:56:30 GMT",
                     "message": "TG-159 #in-progress, adding in getTravelEvent in travel.js",
                     "html_url": "https://github.com/david-henderson/ser517-travlendar/commit/33cd8c696d64e50e7f9f16ba821f0e99d0f4bbe4",
                     "branch": "master",
                     "additions": 19,
                     "deletions": 87,
                     "total": 106
                 },
                 {
                     "timestamp": "Sat, 17 Mar 2018 03:48:11 GMT",
                     "message": "TG-161 #in-progress, adding in getTravelEvents in travel.js",
                     "html_url": "https://github.com/david-henderson/ser517-travlendar/commit/b4285be475e938cb60b380487199c9de50122f07",
                     "branch": "master",
                     "additions": 21,
                     "deletions": 21,
                     "total": 42
                 },
                 {
                     "timestamp": "Sat, 17 Mar 2018 03:31:50 GMT",
                     "message": "Merge branch 'us-160' of github.com:david-henderson/ser517-travlendar into us-160",
                     "html_url": "https://github.com/david-henderson/ser517-travlendar/commit/8f4382e2b53beb7f96fcd242506065b16b3a0020",
                     "branch": "master",
                     "additions": 71,
                     "deletions": 27,
                     "total": 98
                 },
                 {
                     "timestamp": "Sat, 17 Mar 2018 03:27:04 GMT",
                     "message": "TG-158 #in-progress, starting off travel.js",
                     "html_url": "https://github.com/david-henderson/ser517-travlendar/commit/246014a77865357bfacf6bd1f2e90e6d2dae4a85",
                     "branch": "master",
                     "additions": 251,
                     "deletions": 14,
                     "total": 265
                 }
             ]
         },
         {
             "commits": 1,
             "additions": 6,
             "deletions": 3,
             "total": 9,
             "commit_details": [
                 {
                     "timestamp": "Sun, 18 Mar 2018 06:13:14 GMT",
                     "message": "TG-173 #closed, completed settings coordinates in adjusted schema",
                     "html_url": "https://github.com/david-henderson/ser517-travlendar/commit/4044209d9a9b42beb9aca3772e9f0c232d9a6bf7",
                     "branch": "master",
                     "additions": 6,
                     "deletions": 3,
                     "total": 9
                 }
             ]
         },
         {
             "commits": 0,
             "additions": 0,
             "deletions": 0,
             "total": 0,
             "commit_details": []
         }
     ],
     "total_activity": {
         "commits": 7,
         "additions": 438,
         "deletions": 244,
         "total": 682
     },
     "master_activity": {
         "commits": 7,
         "additions": 438,
         "deletions": 244,
         "total": 682
     },
     "inactivity_streaks": []
 },
 {
    "userid": "david-henderson",
     "name": "David Henderson",
     "daily_activity": [
         {
             "commits": 0,
             "additions": 0,
             "deletions": 0,
             "total": 0,
             "commit_details": []
         },
         {
             "commits": 0,
             "additions": 0,
             "deletions": 0,
             "total": 0,
             "commit_details": []
         },
         {
             "commits": 0,
             "additions": 0,
             "deletions": 0,
             "total": 0,
             "commit_details": []
         },
         {
             "commits": 0,
             "additions": 0,
             "deletions": 0,
             "total": 0,
             "commit_details": []
         }
     ],
     "total_activity": {
         "commits": 0,
         "additions": 0,
         "deletions": 0,
         "total": 0
     },
     "master_activity": {
         "commits": 0,
         "additions": 0,
         "deletions": 0,
         "total": 0
     },
     "inactivity_streaks": [
         4
     ]
 }
 ]
 *
 **/
router.get('/github-stats', async(req, res, next) => {
    var data = await get_data(req.query);
    res.send(data.data);
});

module.exports = router;
