/**
 * Created by rgathrey on 3/4/18.
 */
'use strict';
var express = require('express');
var router = express.Router();
var moment = require('moment');
var HashSet = require('hashset');
//var taiga = require('../lib/taiga');

require('moment-timezone');

router.get('/', function(req, res, next) {
    taiga.getTasks({username: 'ram-g-athreya', password: 'Athreya123'});

    res.render('taiga', { title: 'Capstone Taiga Autograder' });
});

module.exports = router;