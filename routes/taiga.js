/**
 * Created by rgathrey on 3/4/18.
 */
'use strict';
var express = require('express');
var router = express.Router();
var moment = require('moment');
var HashSet = require('hashset');
var taiga = require(__dirname + '/../lib/taiga');

require('moment-timezone');

router.get('/', function(req, res, next) {
    // taiga.getProjectActivity({username: 'ram-g-athreya', password: 'Athreya123'}, 'therealdavidhenderson-ser517-travlendar');
    res.render('taiga', { title: 'Capstone Taiga Autograder' });
});

router.post('/', async function(req, res, next) {
    var data = await taiga.getProjectActivity({username: req.body.username, password: req.body.password}, req.body.start_date, req.body.end_date, req.body.slug);
    data.project_url = 'https://tree.taiga.io/project/' + req.body.slug;
    res.render('taiga_stats', {data: data});
});

module.exports = router;