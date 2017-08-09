var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var config = require('../config.js');
var bodyParser = require('body-parser');
var escapeSQL = require('sqlstring');
var jwt = require('jsonwebtoken');

// parse application/x-www-form-urlencoded
var urlParser = bodyParser.urlencoded({extended: false});
// parse application/json
router.use(bodyParser.json());
var async = require('async');


/*********--------------------------*********
 **********------- MYSQL CONNECT ----*********
 **********--------------------------*********/
var client;
function startConnection() {
    console.error('CONNECTING');
    client = mysql.createConnection({
        host: config.mysql_host,
        user: config.mysql_user,
        password: config.mysql_pass,
        database: config.mysql_data
    });
    client.connect(function (err) {
        if (err) {
            console.error('CONNECT FAILED MESSAGE', err.code);
            startConnection();
        } else {
            console.error('CONNECTED MESSAGE');
        }
    });
    client.on('error', function (err) {
        if (err.fatal)
            startConnection();
    });
}
startConnection();
client.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci", function (error, results, fields) {
    if (error) {
        console.log(error);
    } else {
        console.log("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    }
});
client.query("SET CHARACTER SET utf8mb4", function (error, results, fields) {
    if (error) {
        console.log(error);
    } else {
        console.log("SET CHARACTER SET utf8mb4");
    }
});
/*********--------------------------*********
 **********------- FUNCTION ------*********
 **********--------------------------*********/


router.get('/nickname=:nickname', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                var request_uri = decodeURIComponent(req.params.nickname);
                var sqlu = "SELECT * FROM `users` WHERE `nickname` LIKE '%" + request_uri + "%' LIMIT 30";
                client.query(sqlu, function (errr, rsss, fiii) {
                    if (errr) {
                        return res.send(echoResponse(300, 'error', JSON.stringify(errr), true));
                    } else {
                        if (rsss.length > 0) {
                            var arrayUser = [];
                            var key = req.body.key || req.query.key || req.params.key;
                            async.forEachOf(rsss, function (dataElement, i, callback) {
                                isBlockedCheck(key, rsss[i].key, function (isBlocked) {
                                    if (!isBlocked) {
                                        arrayUser.push(rsss[i]);
                                    }
                                    if (i === rsss.length - 1) {
                                        return res.send(echoResponse(200, arrayUser, "success", false));
                                    }
                                });
                            });
                        } else {
                            return res.send(echoResponse(404, 'No user', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

router.get('/email=:email', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                var request_uri = decodeURIComponent(req.params.email);
                var sqlu = "SELECT * FROM `users` WHERE `email`='" + request_uri + "' LIMIT 1";
                client.query(sqlu, function (errr, rsss, fiii) {
                    if (errr) {
                        return res.send(echoResponse(300, 'error', JSON.stringify(errr), true));
                    } else {
                        if (rsss.length > 0) {
                            var key = req.body.key || req.query.key || req.params.key;
                            console.log(key);
                            isBlockedCheck(key, rsss[0].key, function (isBlocked) {
                                if (!isBlocked) {
                                    return res.send(echoResponse(200, rsss, 'success', false));
                                } else {
                                    return res.send(echoResponse(404, 'No user', 'success', true));
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'No user', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});


router.get('/phone_number=:phone_number', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                //var request_uri = decodeURIComponent(req.params.phone_number);
                var calling_code = req.body.calling_code || req.query.calling_code || req.params.calling_code;
                calling_code = calling_code.replace(/\s/g, '');
                var sqlu = "SELECT * FROM `users` WHERE `key` IN (SELECT `users_key` FROM `other_information` WHERE `phone_number`='" + req.params.phone_number + "' AND `calling_code`='" + "+" + calling_code + "')  LIMIT 1";
                client.query(sqlu, function (errr, rsss, fiii) {
                    if (errr) {
                        console.log(errr);
                        return res.send(echoResponse(300, 'error', JSON.stringify(errr), true));
                    } else {
                        console.log(sqlu);
                        if (rsss.length > 0) {
                            var key = req.body.key || req.query.key || req.params.key;
                            isBlockedCheck(key, rsss[0].key, function (isBlocked) {
                                if (!isBlocked) {
                                    console.log();
                                    return res.send(echoResponse(200, rsss, 'success', false));
                                } else {
                                    return res.send(echoResponse(404, 'No user', 'success', true));
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'No user', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});


function isBlockedCheck(key, friend_key, isBlocked) {
    var userSQL = "SELECT * FROM `blocks` WHERE `friend_key`='" + friend_key + "' AND `users_key`='" + key + "' OR `friend_key`='" + key + "' AND `users_key`='" + friend_key + "'";
    client.query(userSQL, function (eBlock, dBlock, fBlock) {
        if (eBlock) {
            isBlocked(false);
        } else {
            if (dBlock.length > 0) {
                isBlocked(true);
            } else {
                isBlocked(false);
            }
        }
    });
}


function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}
/*********--------------------------*********
 **********------ ECHO RESPONSE -----*********
 **********--------------------------*********/
function echoResponse(status, data, message, error) {
    return JSON.stringify({
        status: status,
        data: data,
        message: message,
        error: error
    });
}


module.exports = router;