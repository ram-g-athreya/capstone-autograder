var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var lessMiddleware = require('less-middleware');
var timeout = require('connect-timeout')

var index = require('./routes/index');
var users = require('./routes/users');
var taiga = require('./routes/taiga');

const nodemailer = require('nodemailer');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.locals.moment = require('moment');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
// app.use(timeout('1000s'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(lessMiddleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bootstrap', express.static(path.join(__dirname, '/node_modules/bootstrap/dist')));
app.use('/jquery', express.static(path.join(__dirname, '/node_modules/jquery/dist')));
app.use('/font-awesome', express.static(path.join(__dirname, '/node_modules/font-awesome')));

app.use('/', index);
app.use('/users', users);
app.use('/taiga', taiga);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

process.on('unhandledRejection', (reason, p) => {
    throw new Error(reason);
}).on('uncaughtException', (error) => {
    if(process.env.EMAIL_USERNAME) {
        nodemailer.createTestAccount((err, account) => {
            // create reusable transporter object using the default SMTP transport
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USERNAME,
                    pass: process.env.EMAIL_PASSWORD
                }
            });

            let mailOptions = {
                to: 'ramgnsn5@gmail.com',
                subject: 'Capstone Autograder - Promise Error',
                text: JSON.stringify(error, Object.getOwnPropertyNames(error))
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions, (error, info) => {

            });
        });
    }
});

module.exports = app;
