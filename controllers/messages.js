var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var config = require('../config.js');
var bodyParser = require('body-parser');
var escapeSQL = require('sqlstring');
var jwt = require('jsonwebtoken');
var moment = require('moment-timezone');

// parse application/x-www-form-urlencoded
var urlParser = bodyParser.urlencoded({extended: false});
// parse application/json
router.use(bodyParser.json());

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

router.post('/new', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `messages` WHERE `key`='" + req.body.key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(404, 'This message already exists', 'success', true));
                        } else {
                            var value = [];
                            var insert = [];
                            for (var k in req.body) {
                                if (k != 'access_token') {
                                    insert.push("`" + k + "`");
                                    value.push("'" + req.body[k] + "'");
                                }
                            }
                            var currentTime = moment().tz('Asia/Ho_Chi_Minh').unix();
                            var insertSQL = "INSERT INTO `messages`(" + insert.toString() + ",`time_server`) VALUES(" + value.toString() + ",'" + currentTime + "')";
                            client.query(insertSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log("Vừa thêm message thành công với key " + req.body.key);
                                    var membersSelect = "SELECT * FROM `members` WHERE `conversations_key`='" + req.body.conversations_key + "'";
                                    client.query(membersSelect, function (e, d, f) {
                                        if (e) {
                                            console.log(e);
                                            return res.sendStatus(300);
                                        } else {
                                            if (d.length > 0) {
                                                var insertStatus = "INSERT INTO `message_status`(`is_read`,`conversations_key`,`messages_key`,`users_key`)"
                                                for (var i = 0; i < d.length; i++) {
                                                    if (d[i].users_key === req.body.sender_id) {
                                                        var dataInsertStatus = "VALUES ('1', '" + req.body.conversations_key + "', '" + req.body.key + "', '" + req.body.sender_id + "')";
                                                        client.query(insertStatus + dataInsertStatus);
                                                    } else {
                                                        var dataInsertStatus = "VALUES ('0', '" + req.body.conversations_key + "', '" + req.body.key + "', '" + d[i].users_key + "')";
                                                        client.query(insertStatus + dataInsertStatus);
                                                    }
                                                }

                                            }
                                        }
                                    });

                                    var selectUserSend = "SELECT `nickname` FROM `users` WHERE `key`='" + req.body.sender_id + "'";
                                    client.query(selectUserSend, function (eSend, dSend, fSend) {
                                        if (eSend) {
                                            console.log(eSend);
                                            return res.sendStatus(300);
                                        } else {
                                            if (dSend.length > 0) {
                                                var tokenDevice = "SELECT `key`,`nickname`,`device_token`,`device_type` FROM `users` WHERE `key` IN (SELECT `users_key` FROM `members` WHERE `conversations_key`='" + req.body.conversations_key + "') AND `key`!='" + req.body.sender_id + "'";
                                                client.query(tokenDevice, function (eToken, dataToken, fieldToken) {
                                                    if (eToken) {
                                                        console.log(eToken);
                                                        return res.sendStatus(300);
                                                    } else {
                                                        async.forEachOf(dataToken, function (dataLimit, iLimit, callLimit) {
                                                            sendNotification(req.body.sender_id, dataToken[iLimit].key, dSend[0].nickname + ": " + req.body.content, "message", null);
                                                        });
                                                    }
                                                });
                                            }
                                        }
                                    });


                                    return res.send(echoResponse(200, 'Insert message successfully.', 'success', false));
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
router.post('/update', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var sqlMember = "SELECT * FROM `message_status` WHERE `users_key`='" + req.body.users_key + "' AND `messages_key`='" + req.body.key + "'";
                client.query(sqlMember, function (er, rs, fl) {
                    if (er) {
                        console.log(er);
                    } else {
                        if (rs.length > 0) {
                            var sqlUpdateMember = "UPDATE `message_status` SET `is_read`='1' WHERE `users_key`='" + req.body.users_key + "' AND `messages_key`='" + req.body.key + "'";
                            client.query(sqlUpdateMember);
                            console.log("Cập nhật thành công message_status");
                            return res.send(echoResponse(200, 'Update message status successfully.', 'success', false));
                        } else {
                            return res.send(echoResponse(404, 'This user does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.post('/delete', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var sqlMember = "SELECT * FROM `messages` WHERE `key`='" + req.body.key + "'";
                client.query(sqlMember, function (er, rs, fl) {
                    if (er) {
                        console.log(er);
                    } else {
                        if (rs.length > 0) {
                            var currentTime = moment().tz('Asia/Ho_Chi_Minh').unix();
                            var oldTime = rs[0].time_server;
                            var subtractTime = (parseInt(currentTime, 10) - parseInt(oldTime, 10)) / 60;
                            if (subtractTime <= 2) {
                                var sqlDelete = "DELETE FROM `messages` WHERE `key`='" + req.body.key + "'";
                                client.query(sqlDelete, function (eDelete, dDelete, fDelete) {
                                    if (eDelete) {
                                        console.log(eDelete);
                                        res.send(echoResponse(300, 'error', JSON.stringify(eSelect), true));
                                    } else {
                                        console.log("Vừa xóa messages với key = " + req.body.key);
                                        var sqlDeleteMember = "SELECT * FROM `message_status` WHERE `messages_key`='" + req.body.key + "'";
                                        client.query(sqlDeleteMember);
                                        return res.send(echoResponse(200, 'Delete message successfully.', 'success', false));
                                    }
                                });
                            } else {
                                return res.send(echoResponse(404, 'Delete unsuccessfully. Because exceeded 2 minutes.', 'success', false));
                            }
                        } else {
                            return res.send(echoResponse(404, 'This messages does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------GET MESSAGE UNREAD----------*********/
router.get('/unread', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var type = req.body.type || req.query.type || req.params.type || req.headers['type'];
                var conversations_key = req.body.conversations_key || req.query.conversations_key || req.params.conversations_key || req.headers['conversations_key'];
                var users_key = req.body.users_key || req.query.users_key || req.params.users_key || req.headers['users_key'];

                var sqlselect = "SELECT * FROM `messages` WHERE `conversations_key`='" + conversations_key + "' AND `key` IN (SELECT `messages_key` FROM `message_status` WHERE `users_key`='" + users_key + "' AND `conversations_key`='" + conversations_key + "' AND `is_read`=0)";
                client.query(sqlselect, function (eSelect, rSelect, fSelect) {
                    if (eSelect) {
                        res.send(echoResponse(300, 'error', JSON.stringify(eSelect), true));
                    } else {
                        if (rSelect.length > 0) {
                            if (type === 'data') {
                                res.send(echoResponse(200, rSelect, 'success', false));
                            } else {
                                res.send(echoResponse(200, rSelect.length, 'success', false));
                            }
                        } else {
                            res.send(echoResponse(404, '404 not found', 'success', false));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});


router.get('/readed', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var messages_key = req.body.messages_key || req.query.messages_key || req.params.messages_key || req.headers['messages_key'];
                var users_key = req.body.users_key || req.query.users_key || req.params.users_key || req.headers['users_key'];

                var sqlselect = "SELECT `nickname` FROM `users` WHERE `key`!='" + users_key + "' AND `key` IN (SELECT `users_key` FROM `message_status` WHERE `messages_key`='" + messages_key + "' AND `is_read`=1)";
                client.query(sqlselect, function (eSelect, rSelect, fSelect) {
                    if (eSelect) {
                        res.send(echoResponse(300, 'error', JSON.stringify(eSelect), true));
                    } else {
                        if (rSelect.length > 0) {
                            var data = [];
                            for (var i = 0; i < rSelect.length; i++) {
                                data.push(rSelect[i].nickname);
                            }
                            res.send(echoResponse(200, data.toString(), 'success', false));
                        } else {
                            res.send(echoResponse(404, '404 not found', 'success', false));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

router.get('/conversations=:conversations_key', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var conversations_key = req.body.conversations_key || req.query.conversations_key || req.params.conversations_key || req.headers['conversations_key'];
                var page = req.body.page || req.query.page || req.params.page;
                var per_page = req.body.per_page || req.query.per_page || req.params.per_page;

                var sqlu = "SELECT * FROM `messages` WHERE `conversations_key`='" + conversations_key + "' ORDER BY `time` DESC LIMIT " + parseInt(per_page, 10) + " OFFSET " + parseInt(page, 10) * parseInt(per_page, 10) + "";
                client.query(sqlu, function (eSelect, rSelect, fSelect) {
                    if (eSelect) {
                        res.send(echoResponse(300, 'error', JSON.stringify(eSelect), true));
                    } else {
                        if (rSelect.length > 0) {
                            res.send(echoResponse(200, rSelect, 'success', false));
                        } else {
                            res.send(echoResponse(404, '404 not found', 'success', false));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

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
                                note.alert = noidung;
                                note.sound = 'default';
                                note.topic = "com.smartconnect.chatapp";
                                note.badge = count;
                                if (posts_id) {
                                    note.payload = {
                                        "posts_id": posts_id,
                                        "content": noidung,
                                        "type": kieu
                                    };
                                } else {
                                    note.payload = {
                                        "sender_id": sender_key,
                                        "content": noidung,
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
                                            content: noidung,
                                            type: kieu
                                        },
                                        notification: {
                                            title: 'IUDI',
                                            body: noidung
                                        }
                                    };
                                } else {
                                    message = {
                                        to: dataNguoiNhan[0].device_token,
                                        collapse_key: collapse_key, 
                                        data: {
                                            sender_id: sender_key,
                                            content: noidung,
                                            type: kieu
                                        },
                                        notification: {
                                            title: 'IUDI',
                                            body: noidung
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
