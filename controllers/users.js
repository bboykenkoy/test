var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var config = require('../config.js');
var bodyParser = require('body-parser');
var escapeSQL = require('sqlstring');
var jwt = require('jsonwebtoken');
var moment = require('moment-timezone');

var atob = require('atob');
var btoa = require('btoa');

var async = require('async');

//-- APNS
var apn = require('apn');
var apnService = new apn.Provider({
    cert: "certificates/cert.pem",
    key: "certificates/key.pem",
});
//-- FCM
var FCM = require('fcm-push');
var serverKey = 'AAAAww8tdbc:APA91bGypdYO0D0YTXiGEltVnswbmcoJAmj_GbA00WrRgUORrk7fdk2q3CKNi_wRHtcAbwYzXme3FDgkbsL-QBSlhxiATw-ax49uXtA6QDZRlGvyfNyup9G-NIAjZ7FGUAQEQgyktMQD';
var collapse_key = 'com.android.abc';
var fcm = new FCM(serverKey);



var fetchUrl = require("fetch").fetchUrl;
var cheerio = require("cheerio");
var imgur = require('imgur');
imgur.setClientId('7cb30e33649106f');
imgur.setAPIUrl('https://api.imgur.com/3/');

// parse application/x-www-form-urlencoded
var urlParser = bodyParser.urlencoded({extended: false});
// parse application/json
router.use(bodyParser.json());

/// ----- MAIL
var nodemailer = require('nodemailer');
let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // secure:true for port 465, secure:false for port 587
    auth: {
        user: 'spitfirewar1995@gmail.com',
        pass: 'kzjcnfgjdrjwgwhl'
    }
});

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
            console.error('CONNECT FAILED USERS', err.code);
            startConnection();
        } else {
            console.error('CONNECTED USERS');
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


/*********--------SIGNUP----------*********/
router.post('/signup', urlParser, function (req, res) {
    if (!req.body.key) {
        return res.sendStatus(400);
    }
    var userSQL = "SELECT * FROM `users` WHERE `key`='" + req.body.key + "'";
    client.query(userSQL, function (error, data, fields) {
        if (error) {
            console.log(error);
            return res.sendStatus(300);
        } else {
            if (data.length > 0) {
                return res.send(echoResponse(404, 'This user already exists', 'success', true));
            } else {
                var value = [];
                var insert = [];
                for (var k in req.body) {
                    insert.push("`" + k + "`");
                    value.push("'" + req.body[k] + "'");
                }
                var dataSQL = "INSERT INTO `users`(" + insert.toString() + ") VALUES(" + value.toString() + ")";
                client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                    if (eInsert) {
                        console.log(eInsert);
                        return res.sendStatus(300);
                    } else {
                        console.log("Vừa đăng ký thành công với email " + req.body.email + " bằng thiết bị " + req.body.device_name);
                        return res.send(echoResponse(200, 'Registered successfully.', 'success', false));
                    }
                });
                // client.query("INSERT INTO `notification_count`(`users_key`) VALUES('" + req.body.key + "')");
            }
        }
    });
});


/*********--------SIGNIN----------*********/
router.post('/signin', urlParser, function (req, res) {
    if (!req.body.key) {
        return res.sendStatus(400);
    }
    var userSQL = "SELECT * FROM `users` WHERE `key`='" + req.body.key + "'";
    client.query(userSQL, function (error, data, fields) {
        if (error) {
            console.log(error);
            return res.sendStatus(300);
        } else {
            if (data.length > 0) {

                var currentTime = moment().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD hh:mm:ss');
                var data_key = data[0].key;
                var data_name = data[0].nickname;

                var json = {current_time: currentTime, key: data_key, nickname: data_name};
                var token = jwt.sign(json, config.secret, {expiresIn: '365d'});

                var insert = [];
                for (var k in req.body) {
                    if (k != 'access_token') {
                        insert.push("`" + k + "`=" + "'" + req.body[k] + "'");
                    }
                }
                var dataSQL = "UPDATE `users` SET " + insert.toString() + ", `access_token`='" + token + "' WHERE `key`='" + req.body.key + "'";
                client.query(dataSQL, function (eUpdate, dUpdate, fUpdate) {
                    if (eUpdate) {
                        console.log(eUpdate);
                        return res.sendStatus(300);
                    } else {
                        var userSQL = "SELECT * FROM `other_information` WHERE `users_key`='" + req.body.key + "'";
                        client.query(userSQL, function (errorLog, dataLog, fieldsLog) {
                            if (errorLog) {
                                console.log(errorLog);
                                return res.sendStatus(300);
                            } else {
                                if (dataLog.length > 0 && dataLog[0].annual_income && dataLog[0].academic_level) {
                                    var userSQLDatabase = "SELECT * FROM `users` WHERE `key`='" + req.body.key + "'";
                                    client.query(userSQLDatabase, function (errorDatabase, dataDatabase, fieldsDatabase) {
                                        if (errorDatabase) {
                                            console.log(errorDatabase);
                                            return res.sendStatus(300);
                                        } else {
                                            var recheck = dataDatabase[0];
                                            recheck.access_token = token;
                                            recheck["phone_number"] = dataLog[0].phone_number;
                                            return res.send(JSON.stringify({
                                                status: 200,
                                                data: recheck,
                                                updated: 1,
                                                message: "success",
                                                error: false
                                            }));
                                        }
                                    });

                                } else if (dataLog.length > 0 && dataLog[0].phone_number) {
                                    var userSQLDatabase = "SELECT * FROM `users` WHERE `key`='" + req.body.key + "'";
                                    client.query(userSQLDatabase, function (errorDatabase, dataDatabase, fieldsDatabase) {
                                        if (errorDatabase) {
                                            console.log(errorDatabase);
                                            return res.sendStatus(300);
                                        } else {
                                            var recheck = dataDatabase[0];
                                            recheck.access_token = token;
                                            recheck["phone_number"] = dataLog[0].phone_number;
                                            return res.send(JSON.stringify({
                                                status: 200,
                                                data: recheck,
                                                updated: 0,
                                                message: "success",
                                                error: false
                                            }));
                                        }
                                    });

                                } else {
                                    var userSQLDatabase = "SELECT * FROM `users` WHERE `key`='" + req.body.key + "'";
                                    client.query(userSQLDatabase, function (errorDatabase, dataDatabase, fieldsDatabase) {
                                        if (errorDatabase) {
                                            console.log(errorDatabase);
                                            return res.sendStatus(300);
                                        } else {
                                            var recheck = dataDatabase[0];
                                            recheck.access_token = token;
                                            recheck["phone_number"] = 0;
                                            return res.send(JSON.stringify({
                                                status: 200,
                                                data: recheck,
                                                updated: 0,
                                                message: "success",
                                                error: false
                                            }));
                                        }
                                    });

                                }
                            }
                        });

                    }
                });
            } else {
                return res.send(echoResponse(404, 'Incorrect key or key does not exist', 'success', true));
            }
        }
    });
});


/*********--------Other information----------*********/
router.post('/other_information', urlParser, function (req, res) {
    if (!req.body.users_key) {
        return res.sendStatus(400);
    }
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                var userSQL = "SELECT * FROM `other_information` WHERE `users_key`='" + req.body.users_key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            var insert = [];
                            for (var k in req.body) {
                                if (k != 'access_token' && k != 'email') {
                                    insert.push("`" + k + "`=" + "'" + req.body[k] + "'");
                                }
                            }
                            if (req.body.email) {
                                client.query("UPDATE `users` SET `email`='" + req.body.email + "' WHERE `key`='" + req.body.users_key + "'");
                            }
                            var dataSQL = "UPDATE `other_information` SET " + insert.toString() + " WHERE `users_key`='" + req.body.users_key + "'";
                            client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log("Vừa update other_information thành công cho users_key " + req.body.users_key);
                                    return res.send(echoResponse(200, 'Updated successfully', 'success', false));
                                }
                            });
                        } else {
                            var value = [];
                            var insert = [];
                            for (var k in req.body) {
                                if (k != 'access_token') {
                                    insert.push("`" + k + "`");
                                    value.push("'" + req.body[k] + "'");
                                }
                            }
                            var dataSQL = "INSERT INTO `other_information`(" + insert.toString() + ") VALUES(" + value.toString() + ")";
                            client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log("Vừa thêm other_information thành công cho users_key " + req.body.users_key);
                                    return res.send(echoResponse(200, 'Updated successfully', 'success', false));
                                }
                            });
                        }
                    }
                });
                //---- Kết thúc đoạn xử lý data
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

/*********--------UPDATE Email----------*********/
router.post('/email', urlParser, function (req, res) {
    if (!req.body.key) {
        return res.sendStatus(300);
    }
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                var userSQL = "SELECT * FROM `users` WHERE `email`='" + req.body.email + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(300, 'This email exists.', 'success', false));
                        } else {
                            var dataSQL = "UPDATE `users` SET `email`='" + req.body.email + "' WHERE `key`='" + req.body.key + "'";
                            client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    return res.send(echoResponse(200, 'Updated email successfully', 'success', false));
                                }
                            });
                        }
                    }
                });
                //---- Kết thúc đoạn xử lý data
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------UPDATE Email----------*********/
router.post('/phone', urlParser, function (req, res) {
    if (!req.body.key) {
        return res.sendStatus(300);
    }
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                var userSQL = "SELECT * FROM `other_information` WHERE `phone_number`='" + req.body.phone_number + "' AND `calling_code`='" + req.body.calling_code + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(300, 'This phone number exists.', 'success', false));
                        } else {
                            var check = "SELECT * FROM `other_information` WHERE `users_key`='" + req.body.key + "'";
                            client.query(check, function (eCheck, dCheck, fCheck) {
                                if (eCheck) {
                                    console.log(eCheck);
                                    return res.sendStatus(300);
                                } else {
                                    if (dCheck.length > 0) {
                                        var dataSQL = "UPDATE `other_information` SET `phone_number`='" + req.body.phone_number + "', `calling_code`='" + req.body.calling_code + "' WHERE `users_key`='" + req.body.key + "'";
                                        client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                                            if (eInsert) {
                                                console.log(eInsert);
                                                return res.sendStatus(300);
                                            } else {
                                                return res.send(echoResponse(200, 'Updated phone number successfully', 'success', false));
                                            }
                                        });
                                    } else {
                                        var dataSQL = "INSERT INTO `other_information`(`phone_number`,`calling_code`,`users_key`) VALUES ('" + req.body.phone_number + "','" + req.body.calling_code + "','" + req.body.key + "')";
                                        client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                                            if (eInsert) {
                                                console.log(eInsert);
                                                return res.sendStatus(300);
                                            } else {
                                                return res.send(echoResponse(200, 'Insert phone number successfully', 'success', false));
                                            }
                                        });
                                    }
                                }
                            });

                        }
                    }
                });
                //---- Kết thúc đoạn xử lý data
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------UPDATE INFORMATION----------*********/
router.post('/update', urlParser, function (req, res) {
    if (!req.body.key) {
        return res.sendStatus(300);
    }
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                var userSQL = "SELECT * FROM `users` WHERE `key`='" + req.body.key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            var insert = [];
                            for (var k in req.body) {
                                if (k != 'access_token') {
                                    insert.push("`" + k + "`=" + "'" + req.body[k] + "'");
                                }
                            }
                            var dataSQL = "UPDATE `users` SET " + insert.toString() + " WHERE `key`='" + req.body.key + "'";
                            client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log("Vừa update users thành công cho key " + req.body.key);
                                    return res.send(echoResponse(200, 'Updated successfully', 'success', false));
                                }
                            });
                        } else {
                            return res.send(echoResponse(300, 'This account not exists', 'success', true));
                        }
                    }
                });
                //---- Kết thúc đoạn xử lý data
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

/*********--------GET 1 USER----------*********/
router.get('/:key/type=info&access_token=:access_token', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                var userSQL = "SELECT * FROM `users` WHERE `key`='" + req.params.key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            var userInfoSQL = "SELECT * FROM `other_information` WHERE `users_key`='" + req.params.key + "'";
                            client.query(userInfoSQL, function (infoError, infoData, infoFields) {
                                if (infoError) {
                                    console.log(infoError);
                                    return res.sendStatus(300);
                                } else {
                                    if (infoData.length > 0) {
                                        return res.send(echo5Response(200, data, infoData, "success", false));
                                    } else {
                                        return res.send(echoResponse(200, data, "success", false));
                                    }
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'This user does not exist', 'success', true));
                        }
                    }
                });
                //---- Kết thúc đoạn xử lý data
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------GET ALL Conversation----------*********/
router.get('/:key/type=conversations', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL;
                var page = req.body.page || req.query.page || req.params.page;
                var per_page = req.body.per_page || req.query.per_page || req.params.per_page;

                if (page) {
                    userSQL = "SELECT * FROM conversations INNER JOIN members ON members.conversations_key = conversations.key AND members.users_key = '" + req.params.key + "' AND members.is_deleted='0' ORDER BY `last_action_time` DESC LIMIT " + parseInt(per_page, 10) + " OFFSET " + parseInt(page, 10) * parseInt(per_page, 10) + "";
                } else {
                    userSQL = "SELECT * FROM conversations INNER JOIN members ON members.conversations_key = conversations.key AND members.users_key = '" + req.params.key + "' AND members.is_deleted='0' ORDER BY `last_action_time` DESC";
                }
                client.query(userSQL, function (eM, dM, fM) {
                    if (eM) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (dM.length > 0) {
                            var arrayMembers = [];
                            async.forEachOf(dM, function (dataElement, i, callback) {
                                var memberSelect = "SELECT * FROM `users` WHERE `key` IN (SELECT `users_key` FROM `members` WHERE `conversations_key`='" + dM[i].key + "')";
                                client.query(memberSelect, function (errorMember, dataMember, fieldMember) {
                                    if (errorMember) {
                                        console.log(errorMember);
                                    } else {
                                        var dict = dM[i];
                                        dict.members = dataMember;
                                        arrayMembers.push(dict);
                                        if (i === dM.length - 1) {
                                            return res.send(echoResponse(200, arrayMembers, 'success', false));
                                        }
                                    }
                                });
                            }, function (err) {
                                if (err) {
                                    //handle the error if the query throws an error
                                } else {
                                    //whatever you wanna do after all the iterations are done
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, '404 Not Found.', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});


/*********--------GET ALL FRIEND----------*********/
router.get('/:key/type=friend&access_token=:access_token', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `users` WHERE `key` IN (SELECT `friend_key` FROM `contacts` WHERE `users_key`='" + req.params.key + "')";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(200, data, "success", false));
                        } else {
                            return res.send(echoResponse(404, 'Nobody.', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});


/*********--------GET ALL REQUEST FRIEND----------*********/
router.get('/:key/type=friendrequest&access_token=:access_token', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `users` WHERE `key` IN (SELECT `friend_key` FROM `requests` WHERE `users_key`='" + req.params.key + "')";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(200, data, "success", false));
                        } else {
                            return res.send(echoResponse(404, 'Nobody.', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------GET ALL BLOCK FRIEND----------*********/
router.get('/:key/type=friendblock&access_token=:access_token', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `users` WHERE `key` IN (SELECT `friend_key` FROM `blocks` WHERE `users_key`='" + req.params.key + "')";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(200, data, "success", false));
                        } else {
                            return res.send(echoResponse(404, 'Nobody.', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------CHECK Exits conversation 1-1----------*********/
router.get('/:key/exists=:friend_key', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var condition1 = req.params.key + '-' + req.params.friend_key;
                var condition2 = req.params.friend_key + '-' + req.params.key;
                var userSQL = "SELECT * FROM `conversations` WHERE `key`='" + condition1 + "' OR `key`='" + condition2 + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(200, data, 'success', true));
                        } else {
                            return res.send(echoResponse(404, 'Conversation not found.', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------GET FRIEND ONLINE----------*********/
router.get('/:key/type=friendonline&access_token=:access_token', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `users` WHERE `key` IN (SELECT `friend_key` FROM `contacts` WHERE `users_key`='" + req.params.key + "') AND `status`='online'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(200, data, "success", false));
                        } else {
                            return res.send(echoResponse(404, 'Nobody.', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------GET FRIEND OFFLINE----------*********/
router.get('/:key/type=friendoffline&access_token=:access_token', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `users` WHERE `key` IN (SELECT `friend_key` FROM `contacts` WHERE `users_key`='" + req.params.key + "') AND `status`='offline'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(200, data, "success", false));
                        } else {
                            return res.send(echoResponse(404, 'Nobody.', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------------------------*********
 **********------- FRIENDS ----------*********
 **********--------------------------*********/

/*********--------REQUEST----------*********/
router.post('/request', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `requests` WHERE `friend_key`='" + req.body.users_key + "' AND `users_key`='" + req.body.friend_key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(404, 'You requested.', 'success', true));
                        } else {
                            var insertSQL = "INSERT INTO `requests`(`friend_key`,`message`,`users_key`)";
                            var dataSQL = "VALUES('" + req.body.users_key + "','" + req.body.message + "','" + req.body.friend_key + "')";
                            client.query(insertSQL + dataSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log(req.body.users_key + " gửi lời mời kết bạn tới " + req.body.friend_key);
                                    return res.send(echoResponse(200, 'Requested successfully', 'success', false));
                                }
                            });
                            var currentUser = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='"+req.body.users_key+"'";
                            client.query(currentUser, function(eCurrent, dCurrent, fCurren){
                                if (eCurrent) {
                                    console.log(eCurrent);
                                } else {
                                    // Insert Notification
                                    var currentTime = moment(new Date().getTime()).tz('Asia/Ho_Chi_Minh').valueOf();
                                    insertNotificationNoImage(res, req.body.users_key, dCurrent[0].nickname, dCurrent[0].avatar, "request", currentTime, req.body.friend_key, 0);
                                    sendNotification(req.body.users_key, req.body.friend_key, "send friend request", "request", null);
                                    //-----
                                }
                            });
                            
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------GET notification----------*********/
router.get('/:key/notifications', urlParser ,function(req, res){
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function(err, decoded) {
            if (err) {
                return res.json({ success: false, message: 'Failed to authenticate token.' });
            } else {
                var key = req.body.key || req.query.key || req.params.key;
                var page = req.body.page || req.query.page || req.params.page;
                var per_page = req.body.per_page || req.query.per_page || req.params.per_page;

                var userSQL = "SELECT * FROM `notification_feed` WHERE `users_key`='"+key+"' ORDER BY `time` DESC LIMIT " + parseInt(per_page, 10) + " OFFSET " + parseInt(page, 10) * parseInt(per_page, 10)+"";
                client.query(userSQL, function(error, data, fields){
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(200,data,'success',false));
                        } else {
                            return res.send(echoResponse(404,'No have notification.','success',true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403,'Authenticate: No token provided.','success',true));
    }
});
/*********--------GET Mối quan hệ giữa 2 người----------*********/
router.get('/:key/friend=:friend_key&access_token=:access_token', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `blocks` WHERE `friend_key`='" + req.params.friend_key + "' AND `users_key`='" + req.params.key + "'";
                client.query(userSQL, function (eBlock, dBlock, fBlock) {
                    if (eBlock) {
                        console.log(eBlock);
                        return res.sendStatus(300);
                    } else {
                        if (dBlock.length > 0) {
                            return res.send(echo5Response(200, 'You blocked friend', 0, 'success', false));
                        } else {
                            var userSQL = "SELECT * FROM `blocks` WHERE `friend_key`='" + req.params.key + "' AND `users_key`='" + req.params.friend_key + "'";
                            client.query(userSQL, function (eBlock, dBlock, fBlock) {
                                if (eBlock) {
                                    console.log(eBlock);
                                    return res.sendStatus(300);
                                } else {
                                    if (dBlock.length > 0) {
                                        return res.send(echo5Response(200, 'Friend blocked you', 1, 'success', false));
                                    } else {
                                        var userSQL = "SELECT * FROM `requests` WHERE `friend_key`='" + req.params.key + "' AND `users_key`='" + req.params.friend_key + "'";
                                        client.query(userSQL, function (error, data, fields) {
                                            if (error) {
                                                console.log(error);
                                                return res.sendStatus(300);
                                            } else {
                                                if (data.length > 0) {
                                                    return res.send(echo5Response(200, 'You requested', 2, 'success', false));
                                                } else {
                                                    //---
                                                    var userSQL2 = "SELECT * FROM `requests` WHERE `friend_key`='" + req.params.friend_key + "' AND `users_key`='" + req.params.key + "'";
                                                    client.query(userSQL2, function (error1, data1, fields1) {
                                                        if (error1) {
                                                            console.log(error1);
                                                            return res.sendStatus(300);
                                                        } else {
                                                            if (data1.length > 0) {
                                                                return res.send(echo5Response(200, 'Friend requested', 3, 'success', false));
                                                            } else {
                                                                //---
                                                                var userSQL2 = "SELECT * FROM `contacts` WHERE `friend_key`='" + req.params.friend_key + "' AND `users_key`='" + req.params.key + "'";
                                                                client.query(userSQL2, function (error2, data2, fields2) {
                                                                    if (error2) {
                                                                        console.log(error2);
                                                                        return res.sendStatus(300);
                                                                    } else {
                                                                        if (data2.length > 0) {
                                                                            return res.send(echo5Response(200, 'Friends', 4, 'success', false));
                                                                        } else {
                                                                            return res.send(echo5Response(200, 'No relationship.', 5, 'success', false));
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    });
                                                }
                                            }
                                        });

                                    }
                                }
                            });
                        }
                        //-------------
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------UNREQUEST----------*********/
router.post('/unrequest', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `requests` WHERE `friend_key`='" + req.body.users_key + "' AND `users_key`='" + req.body.friend_key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            removeNotification(res, req.body.friend_key, req.body.users_key, "request");
                            var deleteSQL = "DELETE FROM `requests` WHERE `friend_key`='" + req.body.users_key + "' AND `users_key`='" + req.body.friend_key + "'";
                            client.query(deleteSQL, function (eDelete, dDelete, fDelete) {
                                if (eDelete) {
                                    console.log(eDelete);
                                    return res.sendStatus(300);
                                } else {
                                    return res.send(echoResponse(200, 'Unrequest successfully', 'success', false));
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'This request not exists.', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------UNFRIEND----------*********/
router.post('/unfriend', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                //var removeNotifi = "DELETE FROM `notification_feed` WHERE `users_key`='"+req.body.users_key+"' AND `friend_key`='"+req.body.friend_key+"' OR `friend_key`='" + req.body.users_key + "' AND `users_key`='" + req.body.friend_key + "'";
                //client.query(removeNotifi);
                var currentUser = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='"+req.body.users_key+"'";
                client.query(currentUser, function(eCurrent, dCurrent, fCurren){
                    if (eCurrent) {
                        console.log(eCurrent);
                    } else {
                        // Insert Notification
                        var currentTime = moment(new Date().getTime()).tz('Asia/Ho_Chi_Minh').valueOf();
                        insertNotificationNoImage(res, req.body.users_key, dCurrent[0].nickname, dCurrent[0].avatar, "unfriend", currentTime, req.body.friend_key, 0);
                        sendNotification(req.body.users_key, req.body.friend_key, "has unfriend with you", "unfriend", null);
                        
                        client.query("SELECT `id` FROM `posts` WHERE `users_key`='"+req.body.friend_key+"' OR `users_key`='"+req.body.users_key+"'", function(e,d,f){
                            if (e) {
                                console.log(e);
                            } else {
                                if (d.length > 0) {
                                    async.forEachOf(d, function(dt, i, call){
                                        var deleteRelate = "DELETE FROM `notification_relate` WHERE `posts_id`='" + d[i].id + "' AND `users_key`='" + req.body.users_key + "' OR `users_key`='" + req.body.friend_key + "'";
                                        client.query(deleteRelate);
                                    });
                                }
                            }
                        });
                        //-----
                    }
                });
                

                var userSQL = "DELETE FROM `contacts` WHERE `friend_key`='" + req.body.users_key + "' AND `users_key`='" + req.body.friend_key + "' OR `friend_key`='" + req.body.friend_key + "' AND `users_key`='" + req.body.users_key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        return res.send(echoResponse(200, 'Unfriend successfully', 'success', false));
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

/*********--------BLOCK----------*********/
router.post('/block', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var removeNotifi = "DELETE FROM `notification_feed` WHERE `users_key`='"+req.body.users_key+"' AND `friend_key`='"+req.body.friend_key+"' OR `friend_key`='" + req.body.users_key + "' AND `users_key`='" + req.body.friend_key + "'";
                client.query(removeNotifi);
                var deleteSQL = "DELETE FROM `requests` WHERE `friend_key`='" + req.body.users_key + "' AND `users_key`='" + req.body.friend_key + "' OR `friend_key`='" + req.body.friend_key + "' AND `users_key`='" + req.body.users_key + "'";
                client.query(deleteSQL);
                var userSQL = "DELETE FROM `contacts` WHERE `friend_key`='" + req.body.users_key + "' AND `users_key`='" + req.body.friend_key + "' OR `friend_key`='" + req.body.friend_key + "' AND `users_key`='" + req.body.users_key + "'";
                client.query(userSQL);

                client.query("SELECT `id` FROM `posts` WHERE `users_key`='"+req.body.friend_key+"' OR `users_key`='"+req.body.users_key+"'", function(e,d,f){
                    if (e) {
                        console.log(e);
                    } else {
                        if (d.length > 0) {
                            async.forEachOf(d, function(dt, i, call){
                                var deleteRelate = "DELETE FROM `notification_relate` WHERE `posts_id`='" + d[i].id + "' AND `users_key`='" + req.body.users_key + "' OR `users_key`='" + req.body.friend_key + "'";
                                client.query(deleteRelate);
                            });
                        }
                    }
                });

                var insertSQL = "INSERT INTO `blocks`(`friend_key`,`users_key`) VALUES('" + req.body.friend_key + "','" + req.body.users_key + "')";
                client.query(insertSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        return res.send(echoResponse(200, 'Blocked successfully', 'success', false));
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

/*********--------UNBLOCK----------*********/
router.post('/unblock', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var insertSQL = "SELECT * FROM `blocks` WHERE `friend_key`='" + req.body.friend_key + "' AND `users_key`='" + req.body.users_key + "'";
                client.query(insertSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            var userSQL = "DELETE FROM `blocks` WHERE `friend_key`='" + req.body.friend_key + "' AND `users_key`='" + req.body.users_key + "'";
                            client.query(userSQL);
                            return res.send(echoResponse(200, 'Unblock successfully', 'success', false));
                        } else {
                            return res.send(echoResponse(404, 'You not block this friend', 'success', false));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

/*********--------ACCEPT----------*********/
router.post('/accept', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `requests` WHERE `friend_key`='" + req.body.friend_key + "' AND `users_key`='" + req.body.users_key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            var insertSQL = "INSERT INTO `contacts` (`id`, `friend_key`, `relationship`, `created_time`, `users_key`) VALUES (NULL, '" + req.body.friend_key + "', '" + req.body.relationship + "', '" + req.body.created_time + "', '" + req.body.users_key + "');";

                            client.query(insertSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    var relationship = 0;
                                    if (req.body.relationship) {
                                        relationship = req.body.relationship;
                                    }
                                    var insertSQLfriend = "INSERT INTO `contacts` (`id`, `friend_key`, `relationship`, `created_time`, `users_key`) VALUES (NULL, '" + req.body.users_key + "', '" + relationship + "', '" + req.body.created_time + "', '" + req.body.friend_key + "');";
                                    client.query(insertSQLfriend);
                                    console.log(req.body.users_key + " đã chấp nhận lời mời kết bạn của " + req.body.friend_key);
                                    var deleteSQL = "DELETE FROM `requests` WHERE `friend_key`='" + req.body.friend_key + "' AND `users_key`='" + req.body.users_key + "'";
                                    client.query(deleteSQL);
                                    return res.send(echoResponse(200, 'Accepted successfully', 'success', false));
                                }
                            });
                            var currentUser = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='"+req.body.users_key+"'";
                            client.query(currentUser, function(eCurrent, dCurrent, fCurren){
                                if (eCurrent) {
                                    console.log(eCurrent);
                                } else {
                                    // Insert Notification
                                    var currentTime = moment(new Date().getTime()).tz('Asia/Ho_Chi_Minh').valueOf();
                                    insertNotificationNoImage(res, req.body.users_key, dCurrent[0].nickname, dCurrent[0].avatar, "accept", currentTime, req.body.friend_key, 0);
                                    sendNotification(req.body.users_key, req.body.friend_key, "accepted your friend request", "accept", null);
                                    //-----
                                }
                            });
                            
                        } else {
                            return res.send(echoResponse(404, 'This request not exists.', 'success', true));
                        }
                    }
                });

            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});


/// SET BADGE
// router.post('/badge', urlParser, function (req, res) {
//     var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
//     if (token) {
//         jwt.verify(token, config.secret, function (err, decoded) {
//             if (err) {
//                 return res.json({success: false, message: 'Failed to authenticate token.'});
//             } else {
//                 var selectsql = "SELECT * FROM `notification_count` WHERE `users_key`='"+req.body.key+"'";
//                 client.query(selectsql, function(error, data, fields){
//                     if (error) {
//                         console.log(error);
//                         return res.sendStatus(300);
//                     } else {
//                         if (data.length > 0) {
//                             var updatesql;
//                             var type = req.body.type;
//                             if (type == 'chat') {
//                                 updatesql = "UPDATE `notification_count` SET `chat`='"+req.body.number+"'";
//                             } else {
//                                 updatesql = "UPDATE `notification_count` SET `activity`='"+req.body.number+"'";
//                             }
//                             client.query(updatesql);
//                             return res.send(echoResponse(200, 'Updated successfully', 'success', false));
//                         } else {
//                             return res.send(echoResponse(404, 'This user count not exists.', 'success', true));
//                         }
//                     }
//                 });
//             }
//         });
//     }
// });
/// INSERT SEEN NOTIFICATIONS
router.post('/seen_profile', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var users_key = req.body.users_key;
                var friend_key = req.body.friend_key;
                sendNotification(users_key, friend_key, "has seen your profile", "profile", null);
                seenProfile(res, users_key, friend_key);
                return res.send(echoResponse(200, 'Send seen notification successfully', 'success', false));
            }
        });
    }
});
/*********--------------------------*********
 **********------ ECHO RESPONSE -----*********
 **********--------------------------*********/

/*********--------Facebook Database----------*********/
router.post('/facebook', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secretAdmin, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var json;
                if (isJsonString(req.body.data)) {
                    var arrayJson = req.body.data;
                    json = JSON.parse(arrayJson);
                    // Work
                    if (json.data_work) {
                        var data = json.data_work;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'work');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // Education
                    if (json.data_education) {
                        var data = json.data_education;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'education');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // Contact
                    if (json.data_contact) {
                        var data = json.data_contact;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'contact');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // Info
                    if (json.data_info) {
                        var data = json.data_info;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'info');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // Living
                    if (json.data_living) {
                        var data = json.data_living;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'living');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // Relationship
                    if (json.data_relationship) {
                        var data = json.data_relationship;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'relationship');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_family
                    if (json.data_family) {
                        var data = json.data_family;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'family');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_year
                    if (json.data_year) {
                        var data = json.data_year;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'year');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_about
                    if (json.data_about) {
                        var data = json.data_about;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'about');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_checkin
                    if (json.data_checkin) {
                        var data = json.data_checkin;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'checkin');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_sports
                    if (json.data_sports) {
                        var data = json.data_sports;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'sports');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_music
                    if (json.data_music) {
                        var data = json.data_music;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'music');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_movie
                    if (json.data_movie) {
                        var data = json.data_movie;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'movie');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_tv
                    if (json.data_tv) {
                        var data = json.data_tv;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'tv');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_book
                    if (json.data_book) {
                        var data = json.data_book;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'book');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_game
                    if (json.data_game) {
                        var data = json.data_game;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'game');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_like
                    if (json.data_like) {
                        var data = json.data_like;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'like');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_event
                    if (json.data_event) {
                        var data = json.data_event;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'event');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_group
                    if (json.data_group) {
                        var data = json.data_group;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookData(res, json.facebook, data[n], 'group');
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                    // data_image
                    if (json.data_image) {
                        var data = json.data_image;
                        async.forEachOf(data, function (currentData, n, callback) {
                            insertFacebookImage(res, json.facebook, data[n]);
                            if (n === data.length - 1) {
                                return res.send(echoResponse(200, 'SUCCESS', 'success', false));
                            }
                        });
                    }
                } else {
                    console.log("ERROR JSON");
                    return res.send(echoResponse(404, 'JSON ERROR', 'success', false));
                }

            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

function insertFacebookData(res, facebook_id, name, type) {
    var insertSQL = "SELECT * FROM `facebook_informations` WHERE `users_key` IN (SELECT `key` FROM `users` WHERE `facebook_id`='" + facebook_id + "')";
    client.query(insertSQL, function (error, data, fields) {
        if (error) {
            console.log(error);
        } else {
            if (data.length > 0) {
                var sql = "UPDATE `facebook_informations` SET `name`='" + name + "', `type`='" + type + "' WHERE `users_key` IN (SELECT `key` FROM `users` WHERE `facebook_id`='" + facebook_id + "')";
                client.query(sql, function (errorUpdate, dataUpdate, fieldUpdate) {
                    if (errorUpdate) {
                        console.log(errorUpdate);
                    } else {
                        console.log("OK");
                    }
                });
            } else {
                var selectUser = "SELECT `key` FROM `users` WHERE `facebook_id`='" + facebook_id + "'";
                client.query(selectUser, function (e, d, f) {
                    if (e) {
                        console.log(e);
                    } else {
                        if (d.length > 0) {
                            var sql = "INSERT INTO `facebook_informations`(`name`,`type`,`users_key`) VALUES('" + name + "','" + type + "','" + d[0].key + "')";
                            client.query(sql, function (errorUpdate, dataUpdate, fieldUpdate) {
                                if (errorUpdate) {
                                    console.log(errorUpdate);
                                } else {
                                    console.log("OK");
                                }
                            });
                        } else {
                            console.log("No correct users");
                        }
                    }
                });
            }
        }
    });
}
function insertFacebookImage(res, facebook_id, url) {
    var insertSQL = "SELECT * FROM `facebook_albums` WHERE `users_key` IN (SELECT `key` FROM `users` WHERE `facebook_id`='" + facebook_id + "')";
    client.query(insertSQL, function (error, data, fields) {
        if (error) {
            console.log(error);
        } else {
            if (data.length > 0) {
                var sql = "UPDATE `facebook_albums` SET `url`='" + url + "' WHERE `users_key` IN (SELECT `key` FROM `users` WHERE `facebook_id`='" + facebook_id + "')";
                client.query(sql, function (errorUpdate, dataUpdate, fieldUpdate) {
                    if (errorUpdate) {
                        console.log(errorUpdate);
                    } else {
                        console.log("OK");
                    }
                });
            } else {
                var selectUser = "SELECT `key` FROM `users` WHERE `facebook_id`='" + facebook_id + "'";
                client.query(selectUser, function (e, d, f) {
                    if (e) {
                        console.log(e);
                    } else {
                        if (d.length > 0) {
                            var sql = "INSERT INTO `facebook_albums`(`url`,`users_key`) VALUES('" + url + "','" + d[0].key + "')";
                            client.query(sql, function (errorUpdate, dataUpdate, fieldUpdate) {
                                if (errorUpdate) {
                                    console.log(errorUpdate);
                                } else {
                                    console.log("OK");
                                }
                            });
                        } else {
                            console.log("No correct user");
                        }
                    }
                });
            }
        }
    });
}

function seenProfile(res, users_key, friend_key){
    var time = moment(new Date().getTime()).tz('Asia/Ho_Chi_Minh').valueOf();
    var sql = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='"+users_key+"'";
    client.query(sql, function(error, data, fields){
        if (error) {
            console.log(error);
            return res.sendStatus(300);
        } else {
            var select = "SELECT * FROM `notification_feed` WHERE `friend_key`='" + users_key + "' AND `users_key`='" + friend_key + "' AND `posts_id`='0' AND `type`='profile'";
            client.query(select, function (eSelect, dSelect, fSelect) {
                if (eSelect) {
                    console.log(eSelect);
                    return res.sendStatus(300);
                } else {
                    if (dSelect.length > 0) {
                        //async.forEachOf(dSelect, function (data, i, callback) {
                            var update = "UPDATE `notification_feed` SET `nickname`='" + data[0].nickname + "',`avatar`='" + data[0].avatar + "', `time`='" + time + "', `is_seen`='0' WHERE `friend_key`='" + users_key + "' AND `users_key`='" + friend_key + "' AND `posts_id`='0' AND `type`='profile'";
                            client.query(update, function (e, d, r) {
                                if (e) {
                                    console.log(e);
                                    return res.sendStatus(300);
                                } else {
                                     console.log("UPDATE Notification With Profile");
                                }
                            });
                       // });
                    } else {
                        var insert = "INSERT INTO `notification_feed`(`friend_key`,`nickname`,`avatar`,`type`, `time`, `users_key`, `posts_id`)";
                        var value = "VALUES('" + users_key + "','" + data[0].nickname + "','" + data[0].avatar + "','profile','" + time + "','" + friend_key + "','0')";
                        client.query(insert + value, function (e, d, r) {
                            if (e) {
                                console.log(e);
                                return res.sendStatus(300);
                            } else {
                                console.log("INSERT Notification With Profile");
                            }
                        });
                    }
                }
            });
        }
    });
}

function insertNotificationNoImage(res, friend_key, nickname, avatar, type, time, users_key, posts_id) {
    var select = "SELECT * FROM `notification_feed` WHERE `friend_key`='" + friend_key + "' AND `users_key`='" + users_key + "' AND `posts_id`='" + posts_id + "' AND `type`='" + type + "'";
    client.query(select, function (eSelect, dSelect, fSelect) {
        if (eSelect) {
            console.log(eSelect);
            return res.sendStatus(300);
        } else {
            if (dSelect.length > 0) {
                async.forEachOf(dSelect, function (data, i, callback) {
                    var update = "UPDATE `notification_feed` SET `nickname`='" + nickname + "',`avatar`='" + avatar + "', `time`='" + time + "', `is_seen`='0' WHERE `friend_key`='" + friend_key + "' AND `users_key`='" + users_key + "' AND `posts_id`='" + posts_id + "' AND `type`='" + type + "'";
                    client.query(update, function (e, d, r) {
                        if (e) {
                            console.log(e);
                            return res.sendStatus(300);
                        } else {
                             console.log("UPDATE Notification With Type: "+ type);
                        }
                    });
                });
            } else {
                var insert = "INSERT INTO `notification_feed`(`friend_key`,`nickname`,`avatar`,`type`, `time`, `users_key`, `posts_id`)";
                var value = "VALUES('" + friend_key + "','" + nickname + "','" + avatar + "','" + type + "','" + time + "','" + users_key + "','" + posts_id + "')";
                client.query(insert + value, function (e, d, r) {
                    if (e) {
                        console.log(e);
                        return res.sendStatus(300);
                    } else {
                        console.log("INSERT Notification With Type: "+ type);
                    }
                });
            }
        }
    });
}
function removeNotification(res, users_key, friend_key, type){
    var sql = "SELECT * FROM `notification_feed` WHERE `users_key`='"+users_key+"' AND `friend_key`='"+friend_key+"' AND `type`='"+type+"'";
    client.query(sql, function(error, data, fields){
        if (error) {
            console.log(error);
            return res.sendStatus(300);
        } else {
            if (data.length > 0) {
                var sqlRemove = "DELETE FROM `notification_feed` WHERE `users_key`='"+users_key+"' AND `friend_key`='"+friend_key+"' AND `type`='"+type+"'";
                client.query(sqlRemove);
            }
        }
    });
}
// function sendNotification(sender_key, receiver_key, noidung, kieu){
//     var senderSQL = "SELECT `nickname` FROM `users` WHERE `key`='"+sender_key+"'";
//     client.query(senderSQL, function(loiNguoiGui, dataNguoiGui, FNG){
//         if (loiNguoiGui) {
//             console.log(loiNguoiGui);
//         } else {
//             var badgeSQL = "SELECT * FROM `notification_count` WHERE `users_key`='" +receiver_key+ "'";
//             client.query(badgeSQL, function (loiSoThongBao, dataThongBao, FTB) {
//                 if (loiSoThongBao) {
//                     console.log(loiSoThongBao);
//                 } else {
//                     var updateBadge = parseInt(dataThongBao[0].activity, 10) + 1;
//                     client.query("UPDATE `notification_count` SET `activity`='" + updateBadge + "' WHERE `users_key`='" +receiver_key+ "'");
//                     var receiverSQL = "SELECT `device_token`,`device_type` FROM `users` WHERE `key`='"+receiver_key+"'";
//                     client.query(receiverSQL, function(loiNguoiNhan, dataNguoiNhan, FNN){
//                         if (loiNguoiNhan) {
//                             console.log(loiNguoiNhan);
//                         } else {
//                             if (dataNguoiNhan[0].device_type == 'ios') {
//                                 //--------APNS
//                                 var note = new apn.Notification();
//                                 note.alert = dataNguoiGui[0].nickname + " "+noidung;
//                                 note.sound = 'default';
//                                 note.topic = "com.smartconnect.chatapp";
//                                 note.badge = parseInt(dataThongBao[0].chat, 10) + updateBadge;
//                                 note.payload = {
//                                     "sender_id": sender_key,
//                                     "receiver_id": receiver_key,
//                                     "content": dataNguoiGui[0].nickname + " "+noidung,
//                                     "type": kieu
//                                 };
//                                 apnService.send(note, dataNguoiNhan[0].device_token).then(result => {
//                                     console.log("sent:", result.sent.length);
//                                     console.log("failed:", result.failed.length);
//                                     console.log(result.failed);
//                                 });
//                             } else {
//                                 var message = {
//                                     to: dataNguoiNhan[0].device_token,
//                                     collapse_key: collapse_key, 
//                                     data: {
//                                         sender_id: sender_key,
//                                         receiver_id: receiver_key,
//                                         content: dataNguoiGui[0].nickname + " "+noidung,
//                                         type: kieu
//                                     },
//                                     notification: {
//                                         title: 'IUDI',
//                                         body: dataNguoiGui[0].nickname + " "+noidung
//                                     }
//                                 };
//                                 //callback style
//                                 fcm.send(message, function(err, response){
//                                     if (err) {
//                                         console.log("Something has gone wrong!");
//                                     } else {
//                                         console.log("Successfully sent with response: ", response);
//                                     }
//                                 });
//                             }
//                             //----
//                         }
//                     });
//                 }
//             });  
//         }
//     });
// }
function sendNotification(sender_key, receiver_key, noidung, kieu, posts_id){
    var senderSQL = "SELECT `nickname` FROM `users` WHERE `key`='"+sender_key+"'";
    client.query(senderSQL, function(loiNguoiGui, dataNguoiGui, FNG){
        if (loiNguoiGui) {
            console.log(loiNguoiGui);
        } else {
                numberBadge(receiver_key, function(count){
                    var receiverSQL = "SELECT `device_token`,`device_type` FROM `users` WHERE `key`='"+receiver_key+"'";
                    client.query(receiverSQL, function(loiNguoiNhan, dataNguoiNhan, FNN){
                        if (loiNguoiNhan) {
                            console.log(loiNguoiNhan);
                        } else {
                            if (dataNguoiNhan[0].device_type == 'ios') {
                                //--------APNS
                                var note = new apn.Notification();
                                note.alert = dataNguoiGui[0].nickname + " "+noidung;
                                note.sound = 'default';
                                note.topic = "com.smartconnect.chatapp";
                                note.badge = count;
                                if (posts_id) {
                                    note.payload = {
                                        "posts_id": posts_id,
                                        "content": dataNguoiGui[0].nickname + " "+noidung,
                                        "type": kieu
                                    };
                                } else {
                                    note.payload = {
                                        "sender_id": sender_key,
                                        "content": dataNguoiGui[0].nickname + " "+noidung,
                                        "type": kieu
                                    };
                                }
                                
                                apnService.send(note, dataNguoiNhan[0].device_token).then(result => {
                                    console.log("sent:", result.sent.length);
                                    console.log("failed:", result.failed.length);
                                    console.log(result.failed);
                                });
                            } else {
                                var message;
                                if (posts_id) {
                                    message = {
                                        to: dataNguoiNhan[0].device_token,
                                        collapse_key: collapse_key, 
                                        data: {
                                            posts_id: posts_id,
                                            content: dataNguoiGui[0].nickname + " "+noidung,
                                            type: kieu
                                        },
                                        notification: {
                                            title: 'IUDI',
                                            body: dataNguoiGui[0].nickname + " "+noidung
                                        }
                                    };
                                } else {
                                    message = {
                                        to: dataNguoiNhan[0].device_token,
                                        collapse_key: collapse_key, 
                                        data: {
                                            sender_id: sender_key,
                                            content: dataNguoiGui[0].nickname + " "+noidung,
                                            type: kieu
                                        },
                                        notification: {
                                            title: 'IUDI',
                                            body: dataNguoiGui[0].nickname + " "+noidung
                                        }
                                    };
                                }

                                //callback style
                                fcm.send(message, function(err, response){
                                    if (err) {
                                        console.log("Something has gone wrong!");
                                    } else {
                                        console.log("Successfully sent with response: ", response);
                                    }
                                });
                            }
                        }
                    });
                });
        }
    });
}


/// COUNT BADGE
function numberBadge(key, count){
    var userSQL = "SELECT `key` FROM conversations INNER JOIN members ON members.conversations_key = conversations.key AND members.users_key = '" + key + "' AND members.is_deleted='0'";
    client.query(userSQL, function (qError, qData, qFiels) {
        if (qError) {
            console.log(qError);
            count(0);
        } else {
            if (qData.length > 0) {
                var conversationUnread = [];
                async.forEachOf(qData, function (data, i, call) {
                    var sqlSelect = "SELECT `key` FROM conversations INNER JOIN members ON members.conversations_key = conversations.key AND members.users_key = '" + key + "' AND members.is_deleted='0' AND `key` IN (SELECT `conversations_key` FROM `message_status` WHERE `conversations_key`='" + qData[i].key + "' AND `users_key`='" + key + "' AND `is_read`='0')";
                    client.query(sqlSelect, function (e, d, f) {
                        if (e) {
                            console.log(e);
                            return res.sendStatus(300);
                        } else {
                            if (d.length > 0) {
                                conversationUnread.push(qData[i]);
                            }
                            if (i === qData.length - 1) {
                                var userSQL = "SELECT * FROM `notification_feed` WHERE `users_key`='"+key+"' AND `is_seen`='0'";
                                client.query(userSQL, function(error, data, fields){
                                    if (error) {
                                        console.log(error);
                                        return res.sendStatus(300);
                                    } else {
                                        if (data.length > 0) {
                                            count(conversationUnread.length + data.length);
                                        } else {
                                            count(conversationUnread.length);
                                        }
                                    }
                                });
                            }
                        }
                    });
                });
            } else {
                count(0);
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

function isBase64(str) {
    try {
        return btoa(atob(str)) == str;
    } catch (err) {
        return false;
    }
}
function echoResponse(status, data, message, error) {
    return JSON.stringify({
        status: status,
        data: data,
        message: message,
        error: error
    });
}
function echo5Response(status, data, other, message, error) {
    return JSON.stringify({
        status: status,
        data: data,
        other: other,
        message: message,
        error: error
    });
}

module.exports = router;
