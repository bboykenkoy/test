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
// fillData();
// function fillData(){
//     var selectUser = "SELECT `key` FROM `users` WHERE `key` NOT IN (SELECT `users_key` FROM `notification_count`)";
//     client.query(selectUser, function(e, d, f){
//         if (e) {
//             console.log(e);
//         } else {
//             if (d.length > 0) {
//                 async.forEachOf(d, function(data, limit, call){
//                     var insert = "INSERT INTO `notification_count`(`users_key`) VALUES('"+d[limit].key+"')";
//                     client.query(insert);
//                 });
//             }
//         }
//     });
// }

router.get('/type=wall', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var friend_key = req.body.friend_key || req.query.friend_key || req.params.friend_key;
                var key = req.body.key || req.query.key || req.params.key;
                var selectSQL;

                isFriendCheck(key, friend_key, function (isFriend) {
                    if (isFriend === true) {
                        selectSQL = "SELECT * FROM `posts` WHERE `users_key`='" + friend_key + "'";
                    } else {
                        selectSQL = "SELECT * FROM `posts` WHERE `users_key`='" + friend_key + "' AND `permission`='0'";
                    }
                    var orderBy = "ORDER BY `edited_time` DESC";
                    client.query(selectSQL + orderBy, function (ePost, post, fPost) {
                        if (ePost) {
                            console.log(ePost);
                            return res.sendStatus(300);
                        } else {
                            if (post.length > 0) {
                                var postID = [];
                                var postArray = [];
                                console.log("Tổng số bài viết: " + post.length);
                                async.forEachOf(post, function (dataLimit, iLimit, callLimit) {
                                    isHavePermission(key, post, iLimit, function (isPermission) {
                                        if (isPermission === true) {
                                            postID.push(post[iLimit].id);
                                        }
                                    });
                                    if (iLimit === post.length - 1) {
                                        //console.log(postID);
                                        var moi_lan_lay = 10;
                                        var last_post = req.body.last_post || req.query.last_post || req.params.last_post;
                                        if (last_post) {
                                            var last = postID.indexOf(parseInt(last_post));
                                            if (last === postID.length - 1) {
                                                return res.send(echoResponse(404, 'No posts', 'success', true));
                                            }
                                            var limit;
                                            if (postID.length < last + moi_lan_lay) {
                                                limit = postID.length;
                                            } else {
                                                limit = last + moi_lan_lay + 1;
                                            }
                                            var postArray = [];
                                            var batdau = last + 1;
                                            async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                                if (iPost >= batdau && iPost < limit) {
                                                    getBaseInformationPost(key, res, postID, iPost, limit, postArray);
                                                }
                                            });
                                        } else {
                                            var limit;
                                            if (postID.length < moi_lan_lay) {
                                                limit = postID.length;
                                            } else {
                                                limit = moi_lan_lay;
                                            }

                                            var postArray = [];
                                            async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                                if (iPost < limit) {
                                                    getBaseInformationPost(key, res, postID, iPost, limit, postArray);
                                                }
                                            });
                                        }
                                    }
                                    //
                                });
                                //--- end async
                            } else {
                                return res.send(echoResponse(404, 'This post does not exists', 'success', true));
                            }
                        }
                    });
                });


            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});


router.get('/type=albums', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var friend_key = req.body.friend_key || req.query.friend_key || req.params.friend_key;
                var key = req.body.key || req.query.key || req.params.key;
                var selectSQL;

                isFriendCheck(key, friend_key, function (isFriend) {
                    if (isFriend === true) {
                        selectSQL = "SELECT * FROM `posts` WHERE `users_key`='" + friend_key + "'";
                    } else {
                        selectSQL = "SELECT * FROM `posts` WHERE `users_key`='" + friend_key + "' AND `permission`='0'";
                    }
                    var haveImage = " AND `id` IN (SELECT `posts_id` FROM `store_images` WHERE `users_key`='" + friend_key + "')";
                    var orderBy = "ORDER BY `id` DESC";
                    client.query(selectSQL + haveImage + orderBy, function (ePost, post, fPost) {
                        if (ePost) {
                            console.log(ePost);
                            return res.sendStatus(300);
                        } else {
                            if (post.length > 0) {
                                var postID = [];
                                var postArray = [];
                                console.log("Tổng số bài viết: " + post.length);
                                async.forEachOf(post, function (dataLimit, iLimit, callLimit) {
                                    isHavePermission(key, post, iLimit, function (isPermission) {
                                        if (isPermission === true) {
                                            postID.push(post[iLimit].id);
                                        }
                                    });
                                    if (iLimit === post.length - 1) {
                                        var moi_lan_lay = 10;
                                        var last_post = req.body.last_post || req.query.last_post || req.params.last_post;
                                        if (last_post) {
                                            var last = postID.indexOf(parseInt(last_post));
                                            if (last === postID.length - 1) {
                                                return res.send(echoResponse(404, 'No posts', 'success', true));
                                            }
                                            var limit;
                                            if (postID.length < last + moi_lan_lay) {
                                                limit = postID.length;
                                            } else {
                                                limit = last + moi_lan_lay + 1;
                                            }
                                            var postArray = [];
                                            var batdau = last + 1;
                                            async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                                if (iPost >= batdau && iPost < limit) {
                                                    getImage(res, postID, iPost, limit, postArray);
                                                }
                                            });
                                        } else {
                                            var limit;
                                            if (postID.length < moi_lan_lay) {
                                                limit = postID.length;
                                            } else {
                                                limit = moi_lan_lay;
                                            }

                                            var postArray = [];
                                            async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                                if (iPost < limit) {
                                                    getImage(res, postID, iPost, limit, postArray);
                                                }
                                            });
                                        }
                                    }
                                    //
                                });
                                //--- end async
                            } else {
                                return res.send(echoResponse(404, 'This post does not exists', 'success', true));
                            }
                        }
                    });
                });


            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
function isHavePermission(key, post, limit, isPermission) {
    if (post[limit].permission === 2) {
        var sql = "SELECT * FROM `permissions` WHERE `users_key`='" + key + "' AND `posts_id`='" + post[limit].id + "'";
        client.query(sql, function (error, data, fields) {
            if (error) {
                isPermission(false);
            } else {
                if (data.length > 0) {
                    isPermission(true);
                } else {
                    isPermission(false);
                }
            }
        });
    } else {
        isPermission(true);
    }
}
function isFriendCheck(key, friend_key, isFriend) {
    var sql = "SELECT * FROM `contacts` WHERE `users_key`='" + key + "' AND `friend_key`='" + friend_key + "' OR `users_key`='" + friend_key + "' AND `friend_key`='" + key + "'";
    client.query(sql, function (error, data, fields) {
        if (error) {
            isFriend(false);
        } else {
            if (data.length > 0) {
                isFriend(true);
            } else {
                isFriend(false);
            }
        }
    });
}
////****** FUNC GET BASE DATA -------


router.get('/type=mywall', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var key = req.body.key || req.query.key || req.params.key;
                var selectSQL = "SELECT * FROM `posts` WHERE `users_key`='" + key + "'";
                var orderBy = "ORDER BY `edited_time` DESC";
                client.query(selectSQL + orderBy, function (ePost, post, fPost) {
                    if (ePost) {
                        console.log(ePost);
                        return res.sendStatus(300);
                    } else {
                        if (post.length > 0) {
                            var postID = [];
                            console.log("Tổng số bài viết: " + post.length);
                            async.forEachOf(post, function (dataLimit, iLimit, callLimit) {
                                postID.push(post[iLimit].id);
                                if (iLimit === post.length - 1) {
                                    console.log(postID);
                                    var moi_lan_lay = 10;
                                    var last_post = req.body.last_post || req.query.last_post || req.params.last_post;
                                    if (last_post) {
                                        var last = postID.indexOf(parseInt(last_post));
                                        if (last === postID.length - 1) {
                                            return res.send(echoResponse(404, 'No posts', 'success', true));
                                        }
                                        var limit;
                                        if (postID.length < last + moi_lan_lay) {
                                            limit = postID.length;
                                        } else {
                                            limit = last + moi_lan_lay + 1;
                                        }
                                        var postArray = [];
                                        var batdau = last + 1;
                                        async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                            if (iPost >= batdau && iPost < limit) {
                                                getBaseInformationPost(key, res, postID, iPost, limit, postArray);
                                            }
                                        });
                                    } else {
                                        var limit;
                                        if (postID.length < moi_lan_lay) {
                                            limit = postID.length;
                                        } else {
                                            limit = moi_lan_lay;
                                        }

                                        var postArray = [];
                                        async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                            if (iPost < limit) {
                                                getBaseInformationPost(key, res, postID, iPost, limit, postArray);
                                            }
                                        });
                                    }
                                }
                            });

                        } else {
                            return res.send(echoResponse(404, 'This post does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.get('/type=myalbums', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var key = req.body.key || req.query.key || req.params.key;
                var selectSQL = "SELECT * FROM `posts` WHERE `users_key`='" + key + "'";
                var haveImage = " AND `id` IN (SELECT `posts_id` FROM `store_images` WHERE `users_key`='" + key + "')";
                var orderBy = "ORDER BY `id` DESC";
                client.query(selectSQL + haveImage + orderBy, function (ePost, post, fPost) {
                    if (ePost) {
                        console.log(ePost);
                        return res.sendStatus(300);
                    } else {
                        if (post.length > 0) {
                            var postID = [];
                            console.log("Tổng số bài viết: " + post.length);
                            async.forEachOf(post, function (dataLimit, iLimit, callLimit) {
                                postID.push(post[iLimit].id);
                                if (iLimit === post.length - 1) {
                                    console.log(postID);
                                    var moi_lan_lay = 10;
                                    var last_post = req.body.last_post || req.query.last_post || req.params.last_post;
                                    if (last_post) {
                                        var last = postID.indexOf(parseInt(last_post));
                                        if (last === postID.length - 1) {
                                            return res.send(echoResponse(404, 'No posts', 'success', true));
                                        }
                                        var limit;
                                        if (postID.length < last + moi_lan_lay) {
                                            limit = postID.length;
                                        } else {
                                            limit = last + moi_lan_lay + 1;
                                        }
                                        var postArray = [];
                                        var batdau = last + 1;
                                        async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                            if (iPost >= batdau && iPost < limit) {
                                                getImage(res, postID, iPost, limit, postArray);
                                            }
                                        });
                                    } else {
                                        var limit;
                                        if (postID.length < moi_lan_lay) {
                                            limit = postID.length;
                                        } else {
                                            limit = moi_lan_lay;
                                        }

                                        var postArray = [];
                                        async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                            if (iPost < limit) {
                                                getImage(res, postID, iPost, limit, postArray);
                                            }
                                        });
                                    }
                                }
                            });

                        } else {
                            return res.send(echoResponse(404, 'This post does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.get('/type=feeds', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var key = req.body.key || req.query.key || req.params.key;
                var selectSQL = "SELECT * FROM `posts` WHERE `users_key`='" + key + "' OR `users_key` IN (SELECT `friend_key` FROM `contacts` WHERE `users_key`='" + key + "')";
                var orderBy = "ORDER BY `edited_time` DESC";
                client.query(selectSQL + orderBy, function (ePost, post, fPost) {
                    if (ePost) {
                        console.log(ePost);
                        return res.sendStatus(300);
                    } else {
                        if (post.length > 0) {
                            var postID = [];
                            console.log("Tổng số bài viết: " + post.length);
                            async.forEachOf(post, function (dataLimit, iLimit, callLimit) {
                                isHavePermission(key, post, iLimit, function (isPermission) {
                                    if (isPermission === true) {
                                        postID.push(post[iLimit].id);
                                    }
                                });
                                if (iLimit === post.length - 1) {
                                    console.log(postID);
                                    var moi_lan_lay = 10;
                                    var last_post = req.body.last_post || req.query.last_post || req.params.last_post;
                                    if (last_post) {
                                        var last = postID.indexOf(parseInt(last_post));
                                        console.log("Vị trí của bài viết cuối: " + last);
                                        console.log("Độ dài của feeds: " + postID.length);
                                        if (last === postID.length - 1) {
                                            return res.send(echoResponse(404, 'No posts', 'success', true));
                                        }
                                        var limit;
                                        if (postID.length < last + moi_lan_lay) {
                                            limit = postID.length;
                                        } else {
                                            limit = last + moi_lan_lay + 1;
                                        }
                                        console.log("Giới hạn lấy bài viết: " + limit);
                                        var batdau = last + 1;
                                        var postArray = [];
                                        async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                            if (iPost >= batdau && iPost < limit) {
                                                getBaseInformationPost(key, res, postID, iPost, limit, postArray);
                                            }
                                        });
                                    } else {
                                        var limit;
                                        if (postID.length < moi_lan_lay) {
                                            limit = postID.length;
                                        } else {
                                            limit = moi_lan_lay;
                                        }

                                        var postArray = [];
                                        async.forEachOf(postID, function (dataPost, iPost, callPost) {
                                            if (iPost < limit) {
                                                getBaseInformationPost(key, res, postID, iPost, limit, postArray);

                                            }
                                        });
                                    }
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'No posts', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
router.get('/type=badge', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var key = req.body.key || req.query.key || req.params.key;
                var userSQL = "SELECT * FROM `notification_feed` WHERE `users_key`='"+key+"' AND `is_seen`='0'";
                client.query(userSQL, function(error, data, fields){
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(200,data.length,'success',false));
                        } else {
                            return res.send(echoResponse(404,'No have notification.','success',true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});



function getImage(res, postID, iPost, limit, postArray){
    var slqImage = "SELECT * FROM `store_images` WHERE `posts_id`='"+postID[iPost]+"'";
    client.query(slqImage, function(eImage, dataImage, fielsImage){
        if (eImage) {
            console.log(eImage);
            return res.sendStatus(300);
        } else {
            async.forEachOf(dataImage, function(data, i, callback){
                if (dataImage[i]) {
                    dataImage[i].posts_id = postID[iPost];
                    postArray.push(dataImage[i]);
                }
                if (i === dataImage.length-1) {
                    if (iPost === limit - 1) {
                        return res.send(echoResponse(200, postArray, 'success', false));
                    }
                } 
            });
            
        }
    });
}


function getBaseInformationPost(key, res, postID, iPost, limit, postArray) {
    var postSQL = "SELECT * FROM `posts` WHERE `id`='" + postID[iPost] + "'";
    client.query(postSQL, function (errorPost, post, fiPost) {
        if (errorPost) {
            console.log(errorPost);
        } else {
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
                                var selectAlbums = "SELECT `img_url`,`img_height`,`img_width` FROM `store_images` WHERE `posts_id`='" + postID[iPost] + "'";
                                client.query(selectAlbums, function (eAlbums, albums, fAlbums) {
                                    if (eAlbums) {
                                        console.log(eAlbums);
                                    } else {
                                        post[0].albums = albums;
                                        // VIDEO ALBUMS
                                        var selectVideo = "SELECT `video_url` FROM `store_videos` WHERE `posts_id`='" + postID[iPost] + "'";
                                        client.query(selectVideo, function (eVideo, video, fVideo) {
                                            if (eVideo) {
                                                console.log(eVideo);
                                            } else {
                                                post[0].video = video;
                                                // LIKE LIST
                                                var selectLike = "SELECT `users_key` FROM `likes` WHERE `posts_id`='" + postID[iPost] + "'";
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
                                                        var selectComment = "SELECT * FROM `comments` WHERE `posts_id`='" + postID[iPost] + "'";
                                                        client.query(selectComment, function (eComment, comment, fComment) {
                                                            if (eComment) {
                                                                console.log(eComment);
                                                            } else {
                                                                post[0].count_comment = comment.length;
                                                                postArray.push(post[0]);
                                                                console.log("Bài viết: " + post[0].id);
                                                                //console.log(iPost + "++" + limit);
                                                                if (iPost === limit - 1) {
                                                                    return res.send(echoResponse(200, postArray, 'success', false));
                                                                }
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

        }
    });

}
/*********--------------------------*********
 **********------- END ------*********
 **********--------------------------*********/

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