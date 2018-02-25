'use strict';
var express = require('express');
var router = express.Router();
var moment = require('moment');
var HashSet = require('hashset');

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
    var data = {};

    var commits_hash = new HashSet();


    var date_diff = get_day_difference(req.body.end_date, req.body.start_date) - 1;
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
            since: req.body.start_date,
            until: req.body.end_date,
            per_page: 100,
            author: userid,
            sha: branches[branch_index]
        });

        if(commits.data.length) {
            for(var commits_index = 0; commits_index < commits.data.length; commits_index++) {
                if(commits_hash.contains(commits.data[commits_index].sha)) {
                    continue;
                }
                commits_hash.add(commits.data[commits_index].sha);

                var day_index = get_day_difference(commits.data[commits_index].commit.author.date, req.body.start_date);
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

    data = {
        daily_activity: daily_activity,
        total_activity: total_activity,
        master_activity: master_activity,
        userid: userid
    };
    res.render('github_stats', {data: data, start_date: req.body.start_date});
});

module.exports = router;
