const
  CloudWatch = require('awssum-amazon-cloudwatch').CloudWatch,
  Sns = require('awssum-amazon-sns').Sns,
  fs = require('fs'),
  getIamCreds = require('get-iam-creds');

var config = fs.loadFileSync(__dirname + '/conf/alert.json');

function erf(err) { console.log(err) }

// get creds from env or from IMD if onboard an EC2 instance.
// TODO this pattern sucks. build something cleverer into get-iam-creds
if (process.env.AWS_ID && process.env.AWS_SECRET && process.env.AWS_REGION) {
  var c = {accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET,
    region: 'us-west-2'
  };
  addMetric(c, erf);
} else {
  erf("didn't find AWS_ID, AWS_SECRET, & AWS_REGION in the env. looking in IMD");
  getIamCreds(function(err, c) {
    if (err) return erf(err);
    addMetric(c, erf);
  });
}

// 1. create topic
// 2. subscribe an email to it.
// 3. set up cloudwatch alert + connect to topic via topicArn
// TODO configure SNS topic to allow CloudWatch to publish to it? when's this needed?
function addMetric(creds, cb) {
  var sns = new Sns(creds);
  var cloudwatch = new CloudWatch(creds)
  sns.CreateTopic({ Name: config.topic.name }, function(err, data) {
    if (err) return erf(err)
    var topicArn = data.Body.CreateTopicResponse.CreateTopicResult.TopicArn;
    sns.Subscribe({ Endpoint: config.subscription.endpoint, Protocol: config.subscription.protocol, TopicArn: topicArn }, function(err, data) {
      if (err) return erf(err)
      var putMetricAlarmParams = config.metricAlarmParams;
      putMetricAlarmParams['AlarmActions'] = [topicArn];
      cloudwatch.PutMetricAlarm(putMetricAlarmParams, function(err, data) {
        if (err) return erf(err)
      })
    });
  });
}
