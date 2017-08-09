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
var async = require('async');
//var nude = require('nude');
var request = require('request');
var fs = require('fs');


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
/*var url = 'http://i.imgur.com/8vsAwlM.jpg';

 checkPorn(url, function(isNude){
 console.log(isNude);
 });

 function checkPorn(url, isNude){
 var timePath = moment().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD hh:mm:ss');
 var filePath = timePath + ".jpg";
 request.get({url: url, encoding: 'binary'}, function(err, res){
 fs.writeFile(filePath, res.body, {encoding: 'binary'}, function(errWrite, resWrite){
 nude.scan(filePath, function(result) {
 isNude(result);
 });
 fs.unlinkSync(filePath);
 });
 });
 }*/
router.post('/new', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var value = [];
                var insert = [];
                for (var k in req.body) {
                    if (k != 'access_token' && k != 'video' && k != 'albums' && k != 'photo' && k != 'users' && k != 'tags') {
                        insert.push("`" + k + "`");
                        value.push("'" + req.body[k] + "'");
                    }
                }
                var insertSQL = "INSERT INTO `posts`(" + insert.toString() + ") VALUES(" + value.toString() + ")";
                client.query(insertSQL, function (eInsert, dInsert, fInsert) {
                    if (eInsert) {
                        console.log(eInsert);
                        return res.sendStatus(300);
                    } else {
                        console.log("Vừa thêm bài viết thành công với caption " + req.body.caption);
                        insertRelate(res, req.body.users_key, dInsert.insertId);
                        if (req.body.permission && req.body.permission == 2 && req.body.users) {
                            var json;
                            if (isJsonString(req.body.users)) {
                                json = JSON.parse(req.body.users);
                                for (var n = 0; n < json.length; n++) {
                                    var insertMember = "INSERT INTO `permissions`(`posts_id`,`users_key`)";
                                    var dataMember = "VALUES ('" + dInsert.insertId + "','" + json[n].users_key + "')";
                                    client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                        if (eMember) {
                                            console.log(eMember);
                                            return res.sendStatus(300);
                                        } else {
                                            console.log("INSERT USERS SUCCESS");
                                        }
                                    });
                                }
                            }
                        }
                        if (req.body.tags) {
                            var sqlCurrent = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='" + req.body.users_key + "'";
                            client.query(sqlCurrent, function (cError, cData, cField) {
                                if (cError) {
                                    console.log(cError);
                                    return res.sendStatus(300);
                                } else {
                                    var json;
                                    if (isJsonString(req.body.tags)) {
                                        json = JSON.parse(req.body.tags);
                                        async.forEachOf(json, function (dataJ, j, callBackJ) {
                                            var permissionSQL = "INSERT INTO `permissions`(`posts_id`,`users_key`) VALUES('" + dInsert.insertId + "','" + json[j].users_key + "')";
                                            console.log("INSERT PERMISSION SUCCESS");
                                            client.query(permissionSQL);
                                            var insertMember = "INSERT INTO `tags`(`posts_id`,`users_key`)";
                                            var dataMember = "VALUES ('" + dInsert.insertId + "','" + json[j].users_key + "')";
                                            client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                                if (eMember) {
                                                    console.log(eMember);
                                                    return res.sendStatus(300);
                                                } else {
                                                    insertRelate(res, json[j].users_key, dInsert.insertId);
                                                    insertNotificationNoImage(res, req.body.users_key, cData[0].nickname, cData[0].avatar, 'tag', req.body.posted_time, json[j].users_key, dInsert.insertId);
                                                    sendNotification(req.body.users_key, json[j].users_key, "tagged you in a post", "tag", dInsert.insertId);
                                                    console.log("INSERT TAGS USERS SUCCESS");
                                                }
                                            });
                                        });
                                    }
                                }
                            });
                        }


                        if (req.body.type == 'text') {
                            var sqlCurrent = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='" + req.body.users_key + "'";
                            client.query(sqlCurrent, function (cError, cData, cField) {
                                if (cError) {
                                    console.log(cError);
                                    return res.sendStatus(300);
                                } else {
                                    if (req.body.permission == 0 || req.body.permission == 1) {
                                        /// Gửi notification cho bạn bè
                                        var albumsNotificaton = "SELECT * FROM `users` WHERE `key` IN (SELECT `friend_key` FROM `contacts` WHERE `users_key`='" + req.body.users_key + "')";
                                        client.query(albumsNotificaton, function (errorNotify, dataNotify, fieldNotify) {
                                            if (errorNotify) {
                                                console.log(errorNotify);
                                                return res.sendStatus(300);
                                            } else {
                                                if (dataNotify.length > 0) {
                                                    async.forEachOf(dataNotify, function (data, a, callbackNotify) {
                                                        insertNotificationNoImage(res, req.body.users_key, cData[0].nickname, cData[0].avatar, 'status', req.body.posted_time, dataNotify[a].key, dInsert.insertId);
                                                        sendNotification(req.body.users_key, dataNotify[a].key, "updated their status", "status", dInsert.insertId);
                                                    });
                                                }
                                            }
                                        });
                                        /// Kết thúc gửi notification cho bạn bè
                                    } else {
                                        /// Gửi notification cho người được tags
                                        // var json;
                                        // if (isJsonString(req.body.tags)) {
                                        //     json = JSON.parse(req.body.tags);
                                        //     async.forEachOf(json, function (dataJ, j, callBackJ) {
                                        //         insertNotificationNoImage(res, req.body.users_key, cData[0].nickname, cData[0].avatar, 'status', req.body.posted_time, json[j].users_key, dInsert.insertId);
                                        //         sendNotification(req.body.users_key, json[j].users_key, "updated their status", "status");
                                        //     });
                                        // }
                                        /// Kết thúc gửi notification
                                    }
                                    
                                }
                            });
                        }
                        if (req.body.type == 'albums' || req.body.type == 'photo') {
                            var json;
                            if (isJsonString(req.body.albums)) {
                                json = JSON.parse(req.body.albums);
                                for (var n = 0; n < json.length; n++) {
                                    var insertMember = "INSERT INTO `store_images`(`img_url`,`img_width`,`img_height`,`users_key`,`posts_id`)";
                                    var dataMember = "VALUES ('" + json[n].img_url + "','" + json[n].img_width + "','" + json[n].img_height + "','" + req.body.users_key + "','" + dInsert.insertId + "')";
                                    client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                        if (eMember) {
                                            console.log(eMember);
                                            return res.sendStatus(300);
                                        } else {
                                            console.log("INSERT ALBUMS SUCCESS");
                                        }
                                    });
                                }
                                if (req.body.type == 'albums') {
                                    var sqlCurrent = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='" + req.body.users_key + "'";
                                    client.query(sqlCurrent, function (cError, cData, cField) {
                                        if (cError) {
                                            console.log(cError);
                                            return res.sendStatus(300);
                                        } else {
                                            if (req.body.permission == 0 || req.body.permission == 1) {
                                                /// Gửi notification cho bạn bè
                                                var albumsNotificaton = "SELECT * FROM `users` WHERE `key` IN (SELECT `friend_key` FROM `contacts` WHERE `users_key`='" + req.body.users_key + "')";
                                                client.query(albumsNotificaton, function (errorNotify, dataNotify, fieldNotify) {
                                                    if (errorNotify) {
                                                        console.log(errorNotify);
                                                        return res.sendStatus(300);
                                                    } else {
                                                        if (dataNotify.length > 0) {
                                                            async.forEachOf(dataNotify, function (data, a, callbackNotify) {
                                                                if (json.length === 1) {
                                                                    insertNotificationFeed(res, req.body.users_key, cData[0].nickname, cData[0].avatar, json[0].img_url, 'photo', req.body.posted_time, dataNotify[a].key, dInsert.insertId);
                                                                    sendNotification(req.body.users_key, dataNotify[a].key, "posted photo to their album", "photo", dInsert.insertId);
                                                                } else {
                                                                    insertNotificationNoImage(res, req.body.users_key, cData[0].nickname, cData[0].avatar, json.length + ' photos', req.body.posted_time, dataNotify[a].key, dInsert.insertId);
                                                                    sendNotification(req.body.users_key, dataNotify[a].key, "posted "+json.length+" photos to their album", "albums", dInsert.insertId);
                                                                }
                                                            });
                                                        }
                                                    }
                                                });
                                                /// Kết thúc gửi notification cho bạn bè
                                            } else {
                                                /// Gửi notification cho người được tags
                                                // var json;
                                                // if (isJsonString(req.body.tags)) {
                                                //     json = JSON.parse(req.body.tags);
                                                //     async.forEachOf(json, function (dataJ, j, callBackJ) {
                                                //         insertNotificationNoImage(res, req.body.users_key, cData[0].nickname, cData[0].avatar, 'status', req.body.posted_time, json[j].users_key, dInsert.insertId);
                                                //     });
                                                // }
                                                /// Kết thúc gửi notification
                                            }
                                        }
                                    });
                                }
                                if (req.body.type == 'photo') {
                                    var sqlCurrent = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='" + req.body.users_key + "'";
                                    client.query(sqlCurrent, function (cError, cData, cField) {
                                        if (cError) {
                                            console.log(cError);
                                            return res.sendStatus(300);
                                        } else {
                                            if (req.body.permission == 0 || req.body.permission == 1) {
                                                /// Gửi notification cho bạn bè
                                                var albumsNotificaton = "SELECT * FROM `users` WHERE `key` IN (SELECT `friend_key` FROM `contacts` WHERE `users_key`='" + req.body.users_key + "')";
                                                client.query(albumsNotificaton, function (errorNotify, dataNotify, fieldNotify) {
                                                    if (errorNotify) {
                                                        console.log(errorNotify);
                                                        return res.sendStatus(300);
                                                    } else {
                                                        if (dataNotify.length > 0) {
                                                            async.forEachOf(dataNotify, function (data, a, callbackNotify) {
                                                                insertNotificationFeed(res, req.body.users_key, cData[0].nickname, cData[0].avatar, json[0].img_url, 'photo', req.body.posted_time, dataNotify[a].key, dInsert.insertId);
                                                                sendNotification(req.body.users_key, dataNotify[a].key, "posted photo to their album", "photo", dInsert.insertId);
                                                            });
                                                        }
                                                    }
                                                });
                                                /// Kết thúc gửi notification cho bạn bè
                                            } else {
                                                /// Gửi notification cho người được tags
                                                // var json;
                                                // if (isJsonString(req.body.tags)) {
                                                //     json = JSON.parse(req.body.tags);
                                                //     async.forEachOf(json, function (dataJ, j, callBackJ) {
                                                //         insertNotificationNoImage(res, req.body.users_key, cData[0].nickname, cData[0].avatar, 'status', req.body.posted_time, json[j].users_key, dInsert.insertId);
                                                //     });
                                                // }
                                                /// Kết thúc gửi notification
                                            }
                                        }
                                    });
                                }
                            } else {
                                console.log("ERROR JSON");
                            }
                        } else if (req.body.type == 'video') {
                            var json;
                            if (isJsonString(req.body.video)) {
                                json = JSON.parse(req.body.video);
                                for (var n = 0; n < json.length; n++) {
                                    var insertMember = "INSERT INTO `store_videos`(`video_url`,`users_key`,`posts_id`)";
                                    var dataMember = "VALUES ('" + json[n].video_url + "','" + req.body.users_key + "','" + dInsert.insertId + "')";
                                    client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                        if (eMember) {
                                            console.log(eMember);
                                            return res.sendStatus(300);
                                        } else {
                                            console.log("INSERT VIDEO SUCCESS");
                                        }
                                    });
                                }
                            }
                        }
                        return res.send(echoResponse(200, {
                            id: dInsert.insertId,
                            caption: req.body.caption,
                            location: req.body.location,
                            posted_time: req.body.posted_time,
                            edited_time: req.body.edited_time,
                            permission: req.body.permission,
                            type: req.body.type,
                            users_key: req.body.users_key
                        }, 'success', false));
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
                if (!req.body.id) {
                    return res.sendStatus(300);
                }
                var insert = [];
                for (var k in req.body) {
                    if (k != 'access_token' && k != 'video' && k != 'albums' && k != 'photo' && k != 'users' && k != 'tags') {
                        insert.push("`" + k + "`=" + "'" + req.body[k] + "'");
                    }
                }
                var insertSQL = "UPDATE `posts` SET " + insert.toString() + " WHERE `id`='" + req.body.id + "'";
                client.query(insertSQL, function (eInsert, dInsert, fInsert) {
                    if (eInsert) {
                        console.log(eInsert);
                        return res.sendStatus(300);
                    } else {
                        console.log("Vừa chỉnh sửa bài viết thành công với id " + req.body.id);
                        if (req.body.permission && req.body.permission === 2 && req.body.users) {
                            var deleteData = "DELETE FROM `permissions` WHERE `posts_id`='" + req.body.id + "'";
                            client.query(deleteData);
                            var json;
                            if (isJsonString(req.body.users)) {
                                json = JSON.parse(req.body.users);
                                for (var n = 0; n < json.length; n++) {
                                    var insertMember = "INSERT INTO `permissions`(`posts_id`,`users_key`)";
                                    var dataMember = "VALUES ('" + req.body.id + "','" + json[n].users_key + "')";
                                    client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                        if (eMember) {
                                            console.log(eMember);
                                            return res.sendStatus(300);
                                        } else {
                                            console.log("INSERT USERS SUCCESS");
                                        }
                                    });
                                }
                            }
                        }
                        if (req.body.tags) {
                            var deleteData = "DELETE FROM `tags` WHERE `posts_id`='" + req.body.id + "'";
                            client.query(deleteData);
                            var json;
                            if (isJsonString(req.body.tags)) {
                                json = JSON.parse(req.body.tags);
                                for (var n = 0; n < json.length; n++) {
                                    var insertMember = "INSERT INTO `tags`(`posts_id`,`users_key`)";
                                    var dataMember = "VALUES ('" + dInsert.insertId + "','" + json[n].users_key + "')";
                                    client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                        if (eMember) {
                                            console.log(eMember);
                                            return res.sendStatus(300);
                                        } else {
                                            insertRelate(res, json[n].users_key, dInsert.insertId);
                                            console.log("INSERT TAGS USERS SUCCESS");
                                        }
                                    });
                                }
                            }
                        }
                        if (req.body.type === 'albums' || req.body.type === 'photo') {
                            var deleteData = "DELETE FROM `store_images` WHERE `posts_id`='" + req.body.id + "'";
                            client.query(deleteData);
                            var json;
                            if (isJsonString(req.body.albums)) {
                                json = JSON.parse(req.body.albums);
                                for (var n = 0; n < json.length; n++) {
                                    var insertMember = "INSERT INTO `store_images`(`img_url`,`img_width`,`img_height`,`users_key`,`posts_id`)";
                                    var dataMember = "VALUES ('" + json[n].img_url + "','" + json[n].img_width + "','" + json[n].img_height + "','" + req.body.users_key + "','" + req.body.id + "')";
                                    client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                        if (eMember) {
                                            console.log(eMember);
                                            return res.sendStatus(300);
                                        } else {
                                            console.log("INSERT ALBUMS SUCCESS");
                                        }
                                    });
                                }
                            }
                        } else if (req.body.type === 'video') {
                            var deleteData = "DELETE FROM `store_videos` WHERE `posts_id`='" + req.body.id + "'";
                            client.query(deleteData);
                            var json;
                            if (isJsonString(req.body.video)) {
                                json = JSON.parse(req.body.video);
                                for (var n = 0; n < json.length; n++) {
                                    var insertMember = "INSERT INTO `store_videos`(`video_url`,`users_key`,`posts_id`)";
                                    var dataMember = "VALUES ('" + json[n].video_url + "','" + req.body.users_key + "','" + req.body.id + "')";
                                    client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                        if (eMember) {
                                            console.log(eMember);
                                            return res.sendStatus(300);
                                        } else {
                                            console.log("INSERT VIDEO SUCCESS");
                                        }
                                    });
                                }
                            }
                        }
                        return res.send(echoResponse(200, 'Updated post successfully.', 'success', false));
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
                var selectLike = "SELECT * FROM `posts` WHERE `users_key`='" + req.body.users_key + "' AND `id`='" + req.body.id + "'";
                client.query(selectLike, function (eLike, dLike, fLike) {
                    if (eLike) {
                        console.log(eLike);
                        return res.sendStatus(300);
                    } else {
                        if (dLike.length > 0) {
                            var deleteSQL = "DELETE FROM `posts` WHERE `users_key`='" + req.body.users_key + "' AND `id`='" + req.body.id + "'";
                            client.query(deleteSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log(req.body.users_key + " đã xóa bài viết " + req.body.id + "");
                                    client.query("DELETE FROM `notification_feed` WHERE `posts_id`='" + req.body.id + "'");
                                    client.query("DELETE FROM `notification_relate` WHERE `posts_id`='" + req.body.id + "'");
                                    return res.send(echoResponse(200, 'Deleted successfully.', 'success', false));
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'This post has been deleted in the past.', 'success', false));
                        }
                    }
                })

            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

router.post('/seen', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var selectLike = "SELECT * FROM `notification_feed` WHERE `users_key`='" + req.body.users_key + "' AND `posts_id`='"+req.body.id+"'";
                client.query(selectLike, function (eLike, dLike, fLike) {
                    if (eLike) {
                        console.log(eLike);
                        return res.sendStatus(300);
                    } else {
                        if (dLike.length > 0) {
                            var updateSQL = "UPDATE `notification_feed` SET `is_seen`='1' WHERE `users_key`='" + req.body.users_key + "' AND `posts_id`='"+req.body.id+"'";
                            client.query(updateSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    return res.send(echoResponse(200, 'Updated successfully.', 'success', false));
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'This post has been deleted in the past.', 'success', false));
                        }
                    }
                })

            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------------------------------*********
 **********------- GET INFO 1 bài viết ------*********
 **********---------------------------------*********/
 router.get('/:id/type=info', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    var key = req.body.key || req.query.key || req.params.key;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var postSQL = "SELECT * FROM `posts` WHERE `id`='" + req.params.id + "'";
                client.query(postSQL, function (errorPost, post, fiPost) {
                    if (errorPost) {
                        console.log(errorPost);
                    } else {
                        if (post.length > 0) {
                            var selectCurrent = "SELECT `nickname`,`avatar` FROM `users` WHERE `key`='" + post[0].users_key + "'";
                            client.query(selectCurrent, function (eCurrent, dataCurrent, fieldCurrent) {
                                if (eCurrent) {
                                    console.log(eCurrent);
                                    return res.sendStatus(300);
                                } else {
                                    if (dataCurrent.length > 0) {
                                        post[0].avatar = dataCurrent[0].avatar;
                                        post[0].nickname = dataCurrent[0].nickname;
                                        // TAGED USERS
                                        var selectTags = "SELECT `key`,`nickname`,`avatar` FROM `users` WHERE `key` IN (SELECT `users_key` FROM `tags` WHERE `posts_id`='" + post[0].id + "')";
                                        client.query(selectTags, function (eTag, tags, fTag) {
                                            if (eTag) {
                                                console.log(eTag);
                                                return res.sendStatus(300);
                                            } else {
                                                post[0].tags = tags;
                                                // IMAGES ALBUMS
                                                var selectAlbums = "SELECT `img_url`,`img_height`,`img_width` FROM `store_images` WHERE `posts_id`='" + req.params.id + "'";
                                                client.query(selectAlbums, function (eAlbums, albums, fAlbums) {
                                                    if (eAlbums) {
                                                        console.log(eAlbums);
                                                    } else {
                                                        post[0].albums = albums;
                                                        // VIDEO ALBUMS
                                                        var selectVideo = "SELECT `video_url` FROM `store_videos` WHERE `posts_id`='" + req.params.id + "'";
                                                        client.query(selectVideo, function (eVideo, video, fVideo) {
                                                            if (eVideo) {
                                                                console.log(eVideo);
                                                            } else {
                                                                post[0].video = video;
                                                                // LIKE LIST
                                                                var selectLike = "SELECT `users_key` FROM `likes` WHERE `posts_id`='" + req.params.id + "'";
                                                                client.query(selectLike, function (eLike, like, fLike) {
                                                                    if (eLike) {
                                                                        console.log(eLike);
                                                                    } else {
                                                                        post[0].count_like = like.length;

                                                                        if (like.length > 0) {
                                                                            async.forEachOf(like, function (dataLike, iCurrent, callbackLike) {
                                                                                if (like[iCurrent].users_key === key) {
                                                                                    post[0].is_liked = 1;
                                                                                } else {
                                                                                    post[0].is_liked = 0;
                                                                                }
                                                                            });
                                                                        } else {
                                                                            post[0].is_liked = 0;
                                                                        }

                                                                        // Comment LIST
                                                                        var selectComment = "SELECT * FROM `comments` WHERE `posts_id`='" + req.params.id + "'";
                                                                        client.query(selectComment, function (eComment, comment, fComment) {
                                                                            if (eComment) {
                                                                                console.log(eComment);
                                                                            } else {
                                                                                post[0].count_comment = comment.length;
                                                                                return res.send(echoResponse(200, post[0], 'success', false));
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    } else {
                                        return res.send(echoResponse(404, 'This user is not exists', 'success', true));
                                    }
                                }
                            });
                        } else {
                             return res.send(echoResponse(404, 'This post has been deleted', 'success', true));
                        }
                        

                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.get('/:id/type=like', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var page = req.body.page || req.query.page || req.params.page;
                var per_page = req.body.per_page || req.query.per_page || req.params.per_page;
                var selectSQL = "SELECT `key`,`avatar`,`nickname` FROM `users` WHERE `key` IN (SELECT `users_key` FROM `likes` WHERE `posts_id`='" + req.params.id + "' ORDER BY `id` DESC) LIMIT " + parseInt(per_page, 10) + " OFFSET " + parseInt(page, 10) * parseInt(per_page, 10) + "";
                client.query(selectSQL, function (ePost, like, fPost) {
                    if (ePost) {
                        console.log(ePost);
                        return res.sendStatus(300);
                    } else {
                        if (like.length > 0) {
                            return res.send(echoResponse(200, like, 'success', false));
                        } else {
                            return res.send(echoResponse(404, 'No user like this', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.get('/:id/type=totallike', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var selectSQL = "SELECT * FROM `likes` WHERE `posts_id`='" + req.params.id + "'";
                client.query(selectSQL, function (ePost, like, fPost) {
                    if (ePost) {
                        console.log(ePost);
                        return res.sendStatus(300);
                    } else {
                        if (like.length > 0) {
                            return res.send(echoResponse(200, like.length, 'success', false));
                        } else {
                            return res.send(echoResponse(404, 0, 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.get('/:id/type=totalcomment', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var selectSQL = "SELECT * FROM `comments` WHERE `posts_id`='" + req.params.id + "'";
                client.query(selectSQL, function (ePost, comment, fPost) {
                    if (ePost) {
                        console.log(ePost);
                        return res.sendStatus(300);
                    } else {
                        if (comment.length > 0) {
                            return res.send(echoResponse(200, comment.length, 'success', false));
                        } else {
                            return res.send(echoResponse(404, 0, 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.get('/:id/type=comment', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var page = req.body.page || req.query.page || req.params.page;
                var per_page = req.body.per_page || req.query.per_page || req.params.per_page;
                var selectSQL = "SELECT * FROM `comments` WHERE `posts_id`='" + req.params.id + "' ORDER BY `id` DESC LIMIT " + parseInt(per_page, 10) + " OFFSET " + parseInt(page, 10) * parseInt(per_page, 10) + "";
                client.query(selectSQL, function (ePost, comment, fPost) {
                    if (ePost) {
                        console.log(ePost);
                        return res.sendStatus(300);
                    } else {
                        if (comment.length > 0) {
                            async.forEachOf(comment, function (dataPost, i, callPost) {
                                var getUserSQL = "SELECT `avatar`,`nickname` FROM `users` WHERE `key`='" + comment[i].users_key + "'";
                                client.query(getUserSQL, function (e, d, f) {
                                    if (e) {
                                        console.log(e);
                                        return res.sendStatus(300);
                                    } else {
                                        comment[i].avatar = d[0].avatar;
                                        comment[i].nickname = d[0].nickname;
                                        if (i === comment.length - 1) {
                                            return res.send(echoResponse(200, comment, 'success', false));
                                        }
                                    }
                                });
                            });
                        } else {
                            return res.send(echoResponse(404, 'No user comment this', 'success', true));
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
 **********------- LIKES ------*********
 **********--------------------------*********/
router.post('/like', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var selectLike = "SELECT * FROM `likes` WHERE `users_key`='" + req.body.users_key + "' AND `posts_id`='" + req.body.posts_id + "'";
                client.query(selectLike, function (eLike, dLike, fLike) {
                    if (eLike) {
                        console.log(eLike);
                        return res.sendStatus(300);
                    } else {
                        if (dLike.length > 0) {
                            var deleteSQL = "DELETE FROM `likes` WHERE `users_key`='" + req.body.users_key + "' AND `posts_id`='" + req.body.posts_id + "'";
                            client.query(deleteSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    var keyUserPost = "DELETE FROM `notification_feed` WHERE `posts_id`='" + req.body.posts_id + "' AND `friend_key`='" + req.body.users_key + "' AND `type`='like'";
                                    client.query(keyUserPost, function (eNL, dNL, fNL) {
                                        if (eNL) {
                                            console.log(eNL);
                                            return res.sendStatus(300);
                                        } else {
                                            console.log(req.body.users_key + " bỏ thích " + req.body.posts_id + "");
                                            return res.send(echoResponse(200, 'Unlike successfully.', 'success', false));
                                        }
                                    });
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
                            var insertSQL = "INSERT INTO `likes`(" + insert.toString() + ") VALUES(" + value.toString() + ")";
                            client.query(insertSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    var getUserLike = "SELECT `avatar`,`nickname` FROM `users` WHERE `key`='" + req.body.users_key + "'";
                                    client.query(getUserLike, function (eL, dL, fL) {
                                        if (eL) {
                                            console.log(eL);
                                            return res.sendStatus(300);
                                        } else {
                                            var getPost = "SELECT `users_key` FROM `posts` WHERE `id`='" + req.body.posts_id + "'";
                                            client.query(getPost, function (ePostN, dPostN, fPostN) {
                                                if (ePostN) {
                                                    console.log(ePostN);
                                                    return res.sendStatus(300);
                                                } else {
                                                    isMyPost(req.body.users_key, req.body.posts_id, function (result) {
                                                        if (result == false) {
                                                            var currentTime = moment(new Date().getTime()).tz('Asia/Ho_Chi_Minh').valueOf();
                                                            console.log(currentTime);
                                                            var sqlInsertNotify = "INSERT INTO `notification_feed`(`friend_key`,`avatar`,`nickname`,`type`,`time`,`users_key`,`posts_id`)";
                                                            var dataNotifySQL = "VALUES('" + req.body.users_key + "','" + dL[0].avatar + "','" + dL[0].nickname + "','like','" + currentTime + "','" + dPostN[0].users_key + "','" + req.body.posts_id + "')";
                                                            
                                                            client.query(sqlInsertNotify + dataNotifySQL, function (eFEED, dFEED, fFEED) {
                                                                if (eFEED) {
                                                                    console.log(eFEED);
                                                                    return res.sendStatus(300);
                                                                } else {
                                                                    console.log(req.body.users_key + " thích " + req.body.posts_id + "");
                                                                    return res.send(echoResponse(200, 'Like successfully.', 'success', false));
                                                                }
                                                            });
                                                            sendNotification(req.body.users_key, dPostN[0].users_key, "liked your activity", "like", req.body.posts_id);
                                                        } else {
                                                            return res.send(echoResponse(200, 'Like successfully.', 'success', false));
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });


                                }
                            });
                        }
                    }
                })

            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------------------------*********
 **********------- COMMENTS ------*********
 **********--------------------------*********/
router.post('/comment/new', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var value = [];
                var insert = [];
                for (var k in req.body) {
                    if (k != 'access_token') {
                        insert.push("`" + k + "`");
                        value.push("'" + req.body[k] + "'");
                    }
                }
                var insertSQL = "INSERT INTO `comments`(" + insert.toString() + ") VALUES(" + value.toString() + ")";
                client.query(insertSQL, function (eInsert, dInsert, fInsert) {
                    if (eInsert) {
                        console.log(eInsert);
                        return res.sendStatus(300);
                    } else {
                        console.log(req.body.users_key + " đã bình luận về bài viết " + req.body.posts_id);
                        var selectCurrent = "SELECT `nickname`, `avatar` FROM `users` WHERE `key`='" + req.body.users_key + "'";
                        client.query(selectCurrent, function (eCurrent, dCurrent, fCurrent) {
                            if (eCurrent) {
                                console.log(eCurrent);
                                return res.sendStatus(300);
                            } else {
                                insertRelate(res, req.body.users_key, req.body.posts_id);
                                var selectRelate = "SELECT * FROM `notification_relate` WHERE `posts_id`='" + req.body.posts_id + "' AND `users_key`!='"+req.body.users_key+"'";
                                client.query(selectRelate, function (eRelate, dRelate, fRelate) {
                                    if (eRelate) {
                                        console.log(eRelate);
                                        return res.sendStatus(300);
                                    } else {
                                        if (dRelate.length > 0) {
                                            async.forEachOf(dRelate, function (asyData, asyI, asyCallback) {
                                                isMyPost(dRelate[asyI].users_key, req.body.posts_id, function(result){
                                                    if (result == true) {
                                                        insertNotificationNoImage(res, req.body.users_key, dCurrent[0].nickname, dCurrent[0].avatar, 'comment', req.body.time, dRelate[asyI].users_key, req.body.posts_id);
                                                        sendNotification(req.body.users_key, dRelate[asyI].users_key, "commented on your post", "comment",req.body.posts_id);
                                                    } else {
                                                        insertNotificationNoImage(res, req.body.users_key, dCurrent[0].nickname, dCurrent[0].avatar, 'comment', req.body.time, dRelate[asyI].users_key, req.body.posts_id);
                                                        sendNotification(req.body.users_key, dRelate[asyI].users_key, "commented on their post", "comment",req.body.posts_id);
                                                    }
                                                });
                                                
                                            });
                                            // var sqlremove = "DELETE FROM `notification_relate` WHERE `posts_id`='" + req.body.posts_id + "' AND `users_key`='" + req.body.users_key + "'";
                                            // client.query(sqlremove);
                                            // insertRelate(res, req.body.users_key, req.body.posts_id);
                                        }
                                        //  else {
                                        //     insertRelate(res, req.body.users_key, req.body.posts_id);
                                        //     isMyPost(req.body.users_key, req.body.posts_id, function (result) {
                                        //         console.log(result);
                                        //     });
                                        // }
                                    }
                                });
                            }
                        });


                        return res.send(echoResponse(200, {
                            users_key: req.body.users_key,
                            posts_id: req.body.posts_id,
                            id: dInsert.insertId,
                            type: req.body.type,
                            time: req.body.time,
                            content: req.body.content
                        }, 'success', false));
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.post('/comment/update', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var insert = [];
                for (var k in req.body) {
                    if (k != 'access_token') {
                        insert.push("`" + k + "`=" + "'" + req.body[k] + "'");
                    }
                }
                var dataSQL = "UPDATE `comments` SET " + insert.toString() + " WHERE `id`='" + req.body.id + "'";
                client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                    if (eInsert) {
                        console.log(eInsert);
                        return res.sendStatus(300);
                    } else {
                        console.log(req.body.user_key + " sửa comments " + req.body.id + "");
                        return res.send(echoResponse(200, 'Update comment successfully.', 'success', false));
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.post('/comment/delete', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var selectLike = "SELECT * FROM `comments` WHERE `users_key`='" + req.body.users_key + "' AND `id`='" + req.body.id + "' AND `posts_id`='" + req.body.posts_id + "'";
                client.query(selectLike, function (eLike, dLike, fLike) {
                    if (eLike) {
                        console.log(eLike);
                        return res.sendStatus(300);
                    } else {
                        if (dLike.length > 0) {
                            
                            var slSQL = "SELECT * FROM `comments` WHERE `users_key`='" + req.body.users_key + "' AND `posts_id`='" + req.body.posts_id + "'";
                            client.query(slSQL, function(eC, dC, fC){
                                if (eC) {
                                    console.log(eC);
                                    return res.sendStatus(300);
                                } else {
                                    if (dC.length > 0) {

                                    } else {
                                        var keyUserPost = "DELETE FROM `notification_feed` WHERE `posts_id`='" + req.body.posts_id + "' AND `friend_key`='" + req.body.users_key + "' AND `type`='comment'";
                                        client.query(keyUserPost, function (eNL, dNL, fNL) {
                                            if (eNL) {
                                                console.log(eNL);
                                                return res.sendStatus(300);
                                            } else {
                                                console.log(req.body.users_key + " xóa feed comment " + req.body.posts_id + "");
                                            }
                                        });
                                        var deleteRelate = "DELETE FROM `notification_relate` WHERE `posts_id`='" + req.body.posts_id + "' AND `users_key`='" + req.body.users_key + "'";
                                        client.query(deleteRelate);
                                    }
                                }
                            });
                            //--- delete noti
                            var deleteSQL = "DELETE FROM `comments` WHERE `users_key`='" + req.body.users_key + "' AND `id`='" + req.body.id + "'  AND `posts_id`='" + req.body.posts_id + "'";
                            client.query(deleteSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log(req.body.users_key + " đã xóa comment " + req.body.id + "");
                                    return res.send(echoResponse(200, 'Deleted successfully.', 'success', false));
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'This comment has been deleted in the past.', 'success', false));
                        }
                    }
                })

            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

/*********--------------------------*********
 **********------- END ------*********
 **********--------------------------*********/
function isMyPost(users_key, posts_id, result) {
    var select = "SELECT * FROM `posts` WHERE `id`='" + posts_id + "'";
    client.query(select, function (error, data, fields) {
        if (error) {
            result(false, null);
        } else {
            if (data.length > 0) {
                if (data[0].users_key === users_key) {
                    result(true, data[0].users_key);
                } else {
                    result(false, data[0].users_key);
                }
            } else {
                result(false, null);
            }
        }
    });
}


function insertNotificationFeed(res, friend_key, nickname, avatar, image, type, time, users_key, posts_id) {
    var select = "SELECT * FROM `notification_feed` WHERE `friend_key`='" + friend_key + "' AND `users_key`='" + users_key + "' AND `posts_id`='" + posts_id + "' AND `type`='" + type + "'";
    client.query(select, function (eSelect, dSelect, fSelect) {
        if (eSelect) {
            console.log(eSelect);
            return res.sendStatus(300);
        } else {
            if (dSelect.length > 0) {
                async.forEachOf(dSelect, function (data, i, callback) {
                    // if (dSelect[i].type === type) {
                        var update = "UPDATE `notification_feed` SET `nickname`='" + nickname + "',`avatar`='" + avatar + "', `time`='" + time + "', `is_seen`='0' WHERE `friend_key`='" + friend_key + "' AND `users_key`='" + users_key + "' AND `posts_id`='" + posts_id + "' AND `type`='" + type + "'";
                        client.query(update, function (e, d, r) {
                            if (e) {
                                console.log(e);
                                return res.sendStatus(300);
                            } else {
                                console.log(d);
                            }
                        });
                    // } else {
                    //     var insert = "INSERT INTO `notification_feed`(`friend_key`,`nickname`,`avatar`,`image`,`type`, `time`, `users_key`, `posts_id`)";
                    //     var value = "VALUES('" + friend_key + "'," + nickname + "','" + avatar + "','" + image + "','" + type + "','" + time + "','" + users_key + "','" + posts_id + "')";
                    //     client.query(insert + value, function (e, d, r) {
                    //         if (e) {
                    //             console.log(e);
                    //             return res.sendStatus(300);
                    //         } else {
                    //             console.log(d);
                    //         }
                    //     });
                    // }
                });
            } else {
                var insert = "INSERT INTO `notification_feed`(`friend_key`,`nickname`,`avatar`,`image`,`type`, `time`, `users_key`, `posts_id`)";
                var value = "VALUES('" + friend_key + "','" + nickname + "','" + avatar + "','" + image + "','" + type + "','" + time + "','" + users_key + "','" + posts_id + "')";
                client.query(insert + value, function (e, d, r) {
                    if (e) {
                        console.log(e);
                        return res.sendStatus(300);
                    } else {
                        console.log(d);
                    }
                });
            }
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
                             console.log(d);
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
                        console.log(d);
                    }
                });
            }
        }
    });
}
function insertRelate(res, users_key, posts_id) {
    var select = "SELECT * FROM `notification_relate` WHERE `users_key`='" + users_key + "' AND `posts_id`='" + posts_id + "'";
    client.query(select, function (eSelect, dSelect, fSelect) {
        if (eSelect) {
            console.log(eSelect);
            return res.sendStatus(300);
        } else {
            if (dSelect.length > 0) {

            } else {
                var insert = "INSERT INTO `notification_relate`(`users_key`, `posts_id`)";
                var value = "VALUES('" + users_key + "','" + posts_id + "')";
                client.query(insert + value, function (e, d, r) {
                    if (e) {
                        console.log(e);
                    } else {
                        console.log(d);
                    }
                });
            }
        }
    });
}


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