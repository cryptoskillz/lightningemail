//TODO
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
var s3 = new AWS.S3();

var params = {
  Bucket:  process.env.BUCKET, /* required */
  Prefix: 'ch_'  // Can be your folder name
};
s3.listObjectsV2(params, function(err, data) 
{
  if (err) console.log(err, err.stack); // an error occurred
  else 
  {
  	//loop through the payments
  	data.Contents.forEach(function(obj,index)
  	{
		console.log('Checking '+obj.Key)
		var request = require("request");

		var endpoint = process.env.STRIKEENDPOINT;
		var api_key = process.env.STRIKEAPIKEY;
		var charge_id = obj.Key;

		var options = {
		  method: 'GET',
		  url: endpoint + '/api/v1/charges/' + charge_id,
		  headers: {
		    'cache-control': 'no-cache',
		    'Content-Type': 'application/json' },
		  json: true,
		  auth: {
		    user: api_key,
		    pass: '',
		  }
		};

		request(options, function (error, response, body) {
		  if (error) throw new Error(error);
		  console.log('Paid'+body.paid);
		  if (body.paid == true)
		  {
		  	//it has been paid so we can do somethign with the email forward it or something. 
		  }
		});
    })
  }
  
});

