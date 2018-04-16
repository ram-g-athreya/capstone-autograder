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

router.post('/', async (req, res, next) => {
    octokit.authenticate({
        type: 'token',
        token: req.body.token
    });

    var userid = req.body.userid;
    var commits_hash = new HashSet();
    var user = await octokit.search.users({q: userid});
    var name = await octokit.users.getById({id: user.data.items[0].id});
    name = name.data.name;
    var data;

    var start_date = moment.tz(req.body.start_date, 'America/Phoenix').startOf('day');
    var end_date =  moment.tz(req.body.end_date, 'America/Phoenix').endOf('day');

    var date_diff = get_day_difference(end_date, start_date) + 1;
    var daily_activity = create_daily_activity_array(date_diff);
    var master_activity = {commits: 0, additions: 0, deletions: 0, total: 0};
    var total_activity = {commits: 0, additions: 0, deletions: 0, total: 0};

    var branches_object = await octokit.repos.getBranches({
        owner: req.body.owner,
        repo: req.body.repo,
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
            owner: req.body.owner,
            repo: req.body.repo,
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
                    owner: req.body.owner,
                    repo: req.body.repo,
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

    if(streak_in_progress) {
        inactivity_streaks.push(streak_count);
    }

    data = {
        daily_activity: daily_activity,
        total_activity: total_activity,
        master_activity: master_activity,
        inactivity_streaks: inactivity_streaks,
        userid: userid,
        name: name
    };
    res.render('github_stats', {data: data, start_date: start_date});
});

module.exports = router;
