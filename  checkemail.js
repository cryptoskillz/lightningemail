//check the process env vars
require('dotenv').config();
// Load the SDK for JavaScript
var AWS = require('aws-sdk');
var emlformat = require('eml-format');
const request = require('request');
let keyid = '';
AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.ACCESSKEY;
AWS.config.secretAccessKey = process.env.SECRETACCESSKEY;
AWS.config.region = "eu-west-1";
// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
var s3 = new AWS.S3();
//var ses = new AWS.SES();

//set the up the SQS queue
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

//check it
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
      console.log('No messages');
      return;
    } 
    //get the body of the message
    var dataobj = JSON.parse(data.Messages[0].Body);
    //get the key id
  	keyid = dataobj.Records[0].s3.object.key;
    //debug
    console.log("processing"+keyid)  
    //set up the paramaters for s3       
    var params = {
    Bucket: process.env.BUCKET, 
    Key: keyid
    };
    //get the email
    s3.getObject(params, function(err, data) 
    {
      //check for error
      if (err) console.log(err, err.stack); // an error occurred
      else     
      { 
        //get the body 
        let bufferOriginal = Buffer.from(data.Body);
        //debug
        //console.log(bufferOriginal.toString('utf8'));

        //converrt the buffer to strinf
        var eml = bufferOriginal.toString('utf8');

        //load the email into the email reader
        emlformat.read(eml, function(error, email) 
        {
          //check for error
          if (error) return console.log(error);
          //debug
          //console.log(email.from.email);

          //call the ecs server for a new charge
          request(process.env.SERVERURL+'strike/charge?uid=3&currency=btc&amount=2000&desc='+keyid, function (error, response, body) 
          {
            //get the bodt
            var lightresponse = JSON.parse(body);
            address = lightresponse.payment.payment_request;
            //debug
            console.log("light Address"+address);
            //send email to them asking for payment
            // Create sendEmail params 
            var params = {
              Destination: { /* required */
                ToAddresses: [
                  email.from.email,
                  /* more items */
                ]
              },
              Message: { /* required */
                Body: { /* required */
                  Html: {
                   Charset: "UTF-8",
                   Data: "Please pay me money and I will look at your email use Lighting address "+address
                  },
                  Text: {
                   Charset: "UTF-8",
                   Data: "Please pay me money and I will look at your email use Lighting address "+address
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

            // Create the promise and SES service object
           var sendPromise = new AWS.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

            // Handle promise's fulfilled/rejected states
            sendPromise.then(
              function(data) {
                console.log(data.MessageId);
                //delete the messahe from the queue
                var params = {
                  QueueUrl: process.env.QUEUEURL, /* required */
                  ReceiptHandle: data.Messages[0].ReceiptHandle /* required */
                };
                sqs.deleteMessage(params, function(err, data) {
                  if (err) console.log(err, err.stack); // an error occurred
                  else     console.log(data);           // successful response
                });
              }).catch(
                function(err) {
                console.error(err, err.stack);
              });

          });
        });
      }
    });
  }
});