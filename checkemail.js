//check the process env vars
require('dotenv').config();
// Load the SDK for JavaScript
var AWS = require('aws-sdk');
var emlformat = require('eml-format');
const request = require('request');
var Promise = require('bluebird');

let keyid = '';
AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.ACCESSKEY;
AWS.config.secretAccessKey = process.env.SECRETACCESSKEY;
AWS.config.region = "eu-west-1";
// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
var s3 = new AWS.S3();

//this function gets a message.  Note it is set to deal with one message at a time. 
var sqsGetMessage = function() {
    return new Promise(function(resolve, reject) {
        var params = {
          QueueUrl: process.env.QUEUEURL,
          MaxNumberOfMessages: 1,
          MessageAttributeNames: [
            'All',
            /* more items */
          ],
          VisibilityTimeout: 0,
          WaitTimeSeconds: 0
        };
        sqs.receiveMessage(params, function(err, data) 
        {
          //check there is no error
          if (err) console.log(err, err.stack); // an error occurred
          else     
          {
            //debug
            //console.log(data);
            //console.log(data.Messages[0].ReceiptHandle)  
            //return;

            //check we have some messages
            if (data.Messages == undefined)
            {
              //debug
              //console.log('No messages');

              resolve('');
              return;
            }
            else
            {
              //get the body of the message
              var dataobj = JSON.parse(data.Messages[0].Body);
              //get the key id
              keyid = dataobj.Records[0].s3.object.key;
              resolve(keyid);
              //return;
              //debug
              //console.log("processing"+keyid)  
              //delete message 
              var params = {
                QueueUrl: process.env.QUEUEURL, 
                ReceiptHandle: data.Messages[0].ReceiptHandle 
              };
              //debug
              //resolve(keyid);
              
              sqs.deleteMessage(params, function(err, res) {
                if (err) 
                {
                  resolve('');
                  return;
                }
                else     
                {
                  resolve(keyid);
                  return;
                }
              });
              
            }

            
          }
        });
    })
}



var s3GetObject = function(keyid) {
    return new Promise(function(resolve, reject) {
        //console.log(';g;;'+keyid)
        var params = {
        Bucket: process.env.BUCKET, 
        Key: keyid
        };
        //get the email
        s3.getObject(params, function(err, data) 
        {
          //check for error
          if (err) 
          {
            //console.log(err, err.stack); 
            resolve('');
            return;
          }
          else     
          {
            //todo: remove from queue.
            resolve(data.Body);
            return;
          } 
        });
    })
}

var processEmail = function(emailbuffer) {
    return new Promise(function(resolve, reject) {
        //get the body 
        let bufferOriginal = Buffer.from(emailbuffer);
        //debug
        //console.log(bufferOriginal.toString('utf8'));

        //converrt the buffer to strinf
        var eml = bufferOriginal.toString('utf8');
        //console.log(eml);
        emlformat.read(eml, function(error, email) 
        {
          if (error) resolve('');
          else
            resolve(email.from.email)

        });
        //resolve(result);
    })
}

var getCharge = function(toemail) {
  return new Promise(function(resolve, reject) {
    if (toemail == '')
    {
      resolve('');
      return;
    }
    else
    {
      request(process.env.SERVERURL+'strike/charge?uid=3&currency=btc&amount=2000&desc='+keyid, function (error, response, body) 
      {

        var lightresponse = JSON.parse(body);
        //console.log(lightresponse.payment.id)
        lightaddress = lightresponse.payment.payment_request;
        //rename the email to the name of the lighthing payment. 
         var params = {
          Bucket: process.env.BUCKET, 
          CopySource: process.env.BUCKET+'/'+keyid, 
          Key: lightresponse.payment.id
         };
         s3.copyObject(params, function(err, data) {
           if (err) console.log(err, err.stack); // an error occurred
           else     
           {
             //delete the old object
              var params = {
                Bucket: process.env.BUCKET,
                Key: keyid
              /* where value for 'Key' equals 'pathName1/pathName2/.../pathNameN/fileName.ext' - full path name to your file without '/' at the beginning */
              };
              s3.deleteObject(params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else     
                {
                  //console.log(data);           // successful response
                  resolve(lightaddress);
                  return;
                }
              });
              
           }
         });
        
      })
    }
  })
}


function checkemail()
{
  sqsGetMessage().then(() => {
  s3GetObject(keyid).then(emailbuffer => {
    processEmail(emailbuffer).then(toemail => {
      getCharge(toemail).then(lightaddress => {
        if (keyid == '')
        {
          console.log('no message');
        }
        else
        {
          //finish up send email
          //console.log(keyid);
          //console.log(lightaddress);
          //console.log(toemail)
          //note : you could check for only certain emails such as support@ to send payment requests to.
          var params = {
              Destination: { /* required */
                ToAddresses: [
                  toemail,
                  /* more items */
                ]
              },
              Message: { /* required */
                Body: { /* required */
                  Html: {
                   Charset: "UTF-8",
                   Data: "Please pay me money and I will look at your email use Lighting address "+lightaddress
                  },
                  Text: {
                   Charset: "UTF-8",
                   Data: "Please pay me money and I will look at your email use Lighting address "+lightaddress
                  }
                 },
                 Subject: {
                  Charset: 'UTF-8',
                  Data: 'Pay Cryptoskillz using Lighting'
                 }
                },
              Source: process.env.RESPONDEMAIL, /* required */
              ReplyToAddresses: [
                  process.env.RESPONDEMAIL,
                /* more items */
              ],
            };  
            //console.log(params);  
             
          // Create the promise and SES service object
          var sendPromise = new AWS.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();
          // Handle promise's fulfilled/rejected states
          sendPromise.then(
          function(data) {
            //console.log(data);
          }).catch(
            function(err) {
            console.error(err, err.stack);
          }); 
          
          
        }
      });
     });
    });
  });
}

console.log('Pay per read email script:')
console.log('Checking for new emails');
//call the function
checkemail();
//set it to check every minute
intervalid = setInterval(checkemail, 60000);

