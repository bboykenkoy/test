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
            console.error('CONNECT FAILED CONVERSATION', err.code);
            startConnection();
        } else {
            console.error('CONNECTED CONVERSATION');
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

/*********--------NEW CONVERSATION----------*********/
router.post('/new', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `conversations` WHERE `key`='" + req.body.key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            return res.send(echoResponse(404, 'This conversation already exists', 'success', true));
                        } else {
                            if (!req.body.members) {
                                return res.send(echoResponse(300, 'Need members in conversation.', 'success', true));
                            }
                            var value = [];
                            var insert = [];
                            for (var k in req.body) {
                                if (k != 'access_token' & k != 'members') {
                                    insert.push("`" + k + "`");
                                    value.push("'" + req.body[k] + "'");
                                }
                            }
                            var insertSQL = "INSERT INTO `conversations`(" + insert.toString() + ") VALUES(" + value.toString() + ")";
                            client.query(insertSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log("Vừa thêm conversation thành công với key " + req.body.key);
                                    var json;
                                    if (isJsonString(req.body.members)) {
                                        json = JSON.parse(req.body.members);
                                        for (var n = 0; n < json.length; n++) {
                                            console.log(json[n].user_id);
                                            var insertMember = "INSERT INTO `members`(`users_key`,`conversations_key`)";
                                            var dataMember = "VALUES ('" + json[n].user_id + "','" + req.body.key + "')";
                                            client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                                if (eMember) {
                                                    console.log(eMember);
                                                    return res.sendStatus(300);
                                                } else {
                                                    console.log("INSERT members SUCCESS");
                                                }
                                            });
                                        }
                                        return res.send(echoResponse(200, 'Created conversation successfully.', 'success', false));
                                    } else {
                                        return res.send(echoResponse(404, 'Members error JSON string.', 'success', false));
                                    }

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
/*********--------UPDATE CONVERSATION----------*********/
router.post('/update', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `conversations` WHERE `key`='" + req.body.key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            if (req.body.members) {
                                return res.send(echoResponse(300, 'Update not need members in conversation.', 'failed', true));
                            }
                            var insert = [];
                            for (var k in req.body) {
                                if (k != 'access_token') {
                                    insert.push("`" + k + "`=" + "'" + req.body[k] + "'");
                                }
                            }
                            var dataSQL = "UPDATE `conversations` SET " + insert.toString() + " WHERE `key`='" + req.body.key + "'";
                            client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log("Update conversation thành công với key " + req.body.key);
                                    return res.send(echoResponse(200, 'Updated conversation successfully.', 'success', false));
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'This conversation does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------UPDATE CONVERSATION----------*********/
router.post('/type=add', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `conversations` WHERE `key`='" + req.body.key + "'";
                client.query(userSQL, function (error, data, fields) {
                    if (error) {
                        console.log(error);
                        return res.sendStatus(300);
                    } else {
                        if (data.length > 0) {
                            if (isJsonString(req.body.members)) {
                                json = JSON.parse(req.body.members);
                                for (var n = 0; n < json.length; n++) {
                                    console.log(json[n].user_id);
                                    var insertMember = "INSERT INTO `members`(`users_key`,`conversations_key`)";
                                    var dataMember = "VALUES ('" + json[n].user_id + "','" + req.body.key + "')";
                                    client.query(insertMember + dataMember, function (eMember, rMember, fMember) {
                                        if (eMember) {
                                            console.log(eMember);
                                            return res.sendStatus(300);
                                        } else {
                                            console.log("INSERT members SUCCESS");
                                        }
                                    });
                                }
                                return res.send(echoResponse(200, 'Added members successfully.', 'success', false));
                            } else {
                                return res.send(echoResponse(404, 'Members error JSON string.', 'success', false));
                            }
                        } else {
                            return res.send(echoResponse(404, 'This conversation does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------UPDATE CONVERSATION----------*********/
router.post('/type=remove', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var adminSQL = "SELECT `users_key` FROM `conversations` WHERE `key`='" + req.body.key + "'";
                client.query(adminSQL, function (eAdmin, dataAdmin, fieldAdmin) {
                    if (eAdmin) {
                        console.log(eAdmin);
                        return res.sendStatus(300);
                    } else {
                        if (dataAdmin.length > 0) {
                            if (dataAdmin[0].users_key === req.body.users_key) {
                                var userSQL = "SELECT * FROM `members` WHERE `users_key`='" + req.body.friend_key + "' AND `conversations_key`='" + req.body.key + "'";
                                client.query(userSQL, function (error, data, fields) {
                                    if (error) {
                                        console.log(error);
                                        return res.sendStatus(300);
                                    } else {
                                        if (data.length > 0) {
                                            var sqlAddMember = "DELETE FROM `members` WHERE `users_key`='" + req.body.friend_key + "' AND `conversations_key`='" + req.body.key + "'";
                                            client.query(sqlAddMember, function (eInsert, dInsert, fInsert) {
                                                if (eInsert) {
                                                    console.log(eInsert);
                                                    return res.sendStatus(300);
                                                } else {
                                                    console.log("Xóa members cho " + req.body.key);
                                                    return res.send(echoResponse(200, 'Removed members successfully.', 'success', false));
                                                }
                                            });
                                        } else {
                                            return res.send(echoResponse(404, 'This conversation does not exists', 'success', true));
                                        }
                                    }
                                });
                            } else {
                                return res.send(echoResponse(404, 'You not have permission remove this members.', 'success', true));
                            }
                        } else {
                            return res.send(echoResponse(404, 'This conversation does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});
/*********--------LEAVE GROUP CONVERSATION----------*********/
router.post('/type=leave', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var adminSQL = "SELECT `users_key` FROM `conversations` WHERE `key`='" +req.body.key+ "'";
                client.query(adminSQL, function (eAdmin, dataAdmin, fieldAdmin) {
                    if (eAdmin) {
                        console.log(eAdmin);
                        return res.sendStatus(300);
                    } else {
                        if (dataAdmin.length > 0) {
                            var sqlAddMember = "DELETE FROM `members` WHERE `users_key`='" +req.body.users_key+ "' AND `conversations_key`='" + req.body.key + "'";
                            client.query(sqlAddMember);
                            //----
                            var selectUser = "SELECT * FROM `members` WHERE `conversations_key`='"+req.body.key+"'";
                            client.query(selectUser, function(eSelect, dSelect, fSelect){
                                if (eSelect) {
                                    console.log(eSelect);
                                    return res.sendStatus(300);
                                } else {
                                    if (dSelect.length > 0) {
                                        var updateConver = "UPDATE `conversations` SET `created_by`='"+dSelect[0].users_key+"' WHERE `key`='" +req.body.key+ "'";
                                        client.query(updateConver, function(eUp, dUp, fUp){
                                            if (eUp) {
                                                console.log(eUp);
                                                return res.sendStatus(300);
                                            } else {
                                                return res.send(echoResponse(200, 'Leaved conversation successfully', 'success', false));
                                            }
                                        });
                                    } else {
                                        var removeConver = "DELETE FROM `conversation` WHERE `key`='" +req.body.key+ "'";
                                        client.query(removeConver);
                                        return res.send(echoResponse(200, 'Leaved conversation successfully', 'success', false));
                                    }
                                }
                            });
                            
                        } else {
                            return res.send(echoResponse(404, 'This conversation does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

router.get('/type=countunread', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var key = req.body.key || req.query.key || req.params.key;
                var userSQL = "SELECT `key` FROM conversations INNER JOIN members ON members.conversations_key = conversations.key AND members.users_key = '" + key + "' AND members.is_deleted='0'";
                client.query(userSQL, function (qError, qData, qFiels) {
                    if (qError) {
                        console.log(qError);
                        return res.sendStatus(300);
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
                                            return res.send(echoResponse(200, conversationUnread.length, 'success', false));
                                        }
                                    }
                                });
                            });
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


/*********--------SETTINGS CONVERSATION----------*********/
router.post('/settings', urlParser, function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'];
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                var userSQL = "SELECT * FROM `members` WHERE `users_key`='" + req.body.users_key + "' AND `conversations_key`='" + req.body.conversations_key + "'";
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
                            var dataSQL = "UPDATE `members` SET " + insert.toString() + " WHERE `users_key`='" + req.body.users_key + "' AND `conversations_key`='" + req.body.conversations_key + "'";
                            client.query(dataSQL, function (eInsert, dInsert, fInsert) {
                                if (eInsert) {
                                    console.log(eInsert);
                                    return res.sendStatus(300);
                                } else {
                                    console.log("Update settings conversation thành công với key " + req.body.conversations_key);
                                    return res.send(echoResponse(200, 'Updated settings conversation successfully.', 'success', false));
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'This conversation does not exists', 'success', true));
                        }
                    }
                });
            }
        });
    } else {
        return res.send(echoResponse(403, 'Authenticate: No token provided.', 'success', true));
    }
});

router.get('/:conversations_key/users_key=:key', function (req, res) {
    var token = req.body.access_token || req.query.access_token || req.headers['x-access-token'] || req.params.access_token;
    if (token) {
        jwt.verify(token, config.secret, function (err, decoded) {
            if (err) {
                return res.json({success: false, message: 'Failed to authenticate token.'});
            } else {
                ///-----Check nếu tồn tại access_token thì chạy xuống dưới
                var sqlConver = "SELECT * FROM `conversations` WHERE `key`='" + req.params.conversations_key + "'";
                client.query(sqlConver, function (eConver, dConver, fConver) {
                    if (eConver) {
                        console.log(eConver);
                        return res.sendStatus(300);
                    } else {
                        if (dConver.length > 0) {
                            var sqlUser = "SELECT * FROM `users` WHERE `key` IN (SELECT `users_key` FROM `members` WHERE `conversations_key`='" + req.params.conversations_key + "')";
                            client.query(sqlUser, function (errr, rsss, fiii) {
                                if (errr) {
                                    return res.send(echoResponse(300, 'error', JSON.stringify(errr), true));
                                } else {
                                    if (rsss.length > 0) {
                                        var dataResponse = dConver[0];
                                        dataResponse.members = rsss;
                                        var sqlMembers = "SELECT * FROM `members` WHERE `conversations_key`='" + req.params.conversations_key + "' AND `users_key`='" + req.params.key + "'";
                                        client.query(sqlMembers, function (e, d, f) {
                                            if (e) {
                                                console.log(e);
                                                return res.sendStatus(300);
                                            } else {
                                                if (d.length > 0) {
                                                    dataResponse.settings = d[0];
                                                    return res.send(echoResponse(200, dataResponse, 'success', false));
                                                } else {
                                                    return res.send(echoResponse(404, 'No members', 'success', true));
                                                }
                                            }
                                        });
                                    } else {
                                        return res.send(echoResponse(404, 'No user', 'success', true));
                                    }
                                }
                            });
                        } else {
                            return res.send(echoResponse(404, 'This conversation does not exists', 'success', true));
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
 **********------ ECHO RESPONSE -----*********
 **********--------------------------*********/


function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function echoResponse(status, data, message, error) {
    return JSON.stringify({
        status: status,
        data: data,
        message: message,
        error: error
    });
}
module.exports = router;
