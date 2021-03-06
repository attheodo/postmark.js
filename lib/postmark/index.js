var check_message_format = function(message) {
  var valid_attachment_parameters = ["Name", "Content", "ContentType", "ContentID"];
  var valid_parameters = ["From", "To", "Cc", "Bcc", "Subject", "Tag", "HtmlBody", "TextBody", "ReplyTo", "Headers", "Attachments", "TrackOpens"];

  var attr, attach;
  for (attr in message) {
    if (valid_parameters.indexOf(attr) < 0)  {
      throw("You can only provide attributes that work with the Postmark JSON message format. Details: http://developer.postmarkapp.com/developer-build.html#message-format");
    }
    if (attr == "Attachments") {
      for(attach in message[attr])  {
        var attach_attr;
        for (attach_attr in message[attr][attach])  {
          if (valid_attachment_parameters.indexOf(attach_attr) < 0)  {
            throw("You can only provide attributes for attachments that work with the Postmark JSON message format. Details: http://developer.postmarkapp.com/developer-build.html#attachments");
          }
        }
      }
    }
  }
};

module.exports = (function (api_key, options) {
  if (typeof api_key == undefined)  {
    throw("You must provide your postmark API key");
  }
  if (typeof options === 'undefined')  { options = {}; }
  if (options.ssl && options.ssl !== true) { options.ssl = false; }
  if (options.test && options.test !== true) { options.test = false; }

  var client = require('http' + (options.ssl === true ? 's' : ''));

  var postmark_headers = {
    "Accept":  "application/json",
    "Content-Type":  "application/json"
  };

  postmark_headers["X-Postmark-Server-Token"] = options.test === true ? 'POSTMARK_API_TEST' : api_key;

  return {
    send: function(message, callback) {
      //throw exception if message is improperly formatted
      check_message_format(message);
      var msg = JSON.stringify(message);

      postmark_headers['Content-Length'] = Buffer.byteLength(msg);

      var req = client.request({
        host: "api.postmarkapp.com",
        path: "/email",
        method: "POST",
        headers: postmark_headers,
        port: (options.ssl ? 443 : 80)
      }, function (response) {
        var body = "";
        response.on("data", function (i) { body += i; })
        response.on("end", function () {
          if (response.statusCode == 200) {
            if (callback) {
              var ret = message["To"];
              try {
                ret = JSON.parse(body);
              } catch (e) {
                ret = message["To"];
              }
              callback(null, ret);
            }
          } else {
            if (callback) {
              var data;
              try {
                data = JSON.parse(body);
              } catch (e) {
                callback({
                  status: 404,
                  message: "Unsupported Request Method and Protocol",
                  code: -1 // this is a fake error code !
                });
              }
              callback({
                status: response.statusCode,
                message: data['Message'],
                code: data['ErrorCode']
              });

            }
          }
        });
      });

      req.on('error', function(err) {
        if (callback) {
          callback(err);
        }
      });

      req.write(msg);
      req.end();
    },

    batch: function(messages, callback) {

      // check that all messages are properly formatted
      messages.forEach(function (message) {
        check_message_format(message);
      });

      var msg = JSON.stringify(messages);
      postmark_headers['Content-Length'] = Buffer.byteLength(msg);

      var req = client.request({
        host: "api.postmarkapp.com",
        path: "/email/batch",
        method: "POST",
        headers: postmark_headers,
        port: (options.ssl ? 443 : 80)
      }, function (response) {
        var body = "";
        response.on("data", function (i) { body += i; });
        response.on("end", function () {
          if (response.statusCode == 200) {
            if (callback) {
              callback(null, body);
            }
          } else {
            if (callback) {
              var data = JSON.parse(body);
              callback(data);
            }
          }
        });
      });

      req.on('error', function(err) {
        if (callback) {
          callback(err);
        }
      });

      req.write(msg);
      req.end();
    }
  }
});
