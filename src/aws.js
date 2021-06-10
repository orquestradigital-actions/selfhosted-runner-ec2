const AWS = require('aws-sdk');
const core = require('@actions/core');
const config = require('./config');

async function startEc2Instance(label, githubRegistrationToken) {
  const ec2 = new AWS.EC2();

  //TODO: Avaliar a possibilidade a instalação e processo de atualização do script dentro da AMI ou por meio do System Manager
  const userData = [
    '#!/bin/bash',
    'mkdir actions-runner && cd actions-runner',
    'case $(uname -m) in aarch64) ARCH="arm64" ;; amd64|x86_64) ARCH="x64" ;; esac && export RUNNER_ARCH=${ARCH}',
    'curl -O -L https://github.com/actions/runner/releases/download/v2.278.0/actions-runner-linux-${RUNNER_ARCH}-2.278.0.tar.gz',
    'tar xzf ./actions-runner-linux-${RUNNER_ARCH}-2.278.0.tar.gz',
    'export RUNNER_ALLOW_RUNASROOT=1',
    'export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1',
    `./config.sh --url https://github.com/${config.githubContext.owner}/${config.githubContext.repo} --token ${githubRegistrationToken} --labels ${label}`,
    './run.sh',
  ];

  const params = {
    //TODO: Avaliar se há outros possíveis parâmetros que sejam úteis
    //TODO: Permitir a criação como spot!
    ImageId: config.input.ec2ImageId,
    InstanceType: config.input.ec2InstanceType,
    MinCount: 1,
    MaxCount: 1,
    UserData: Buffer.from(userData.join('\n')).toString('base64'),
    SubnetId: config.input.subnetId,
    SecurityGroupIds: [config.input.securityGroupId],
    IamInstanceProfile: { Name: config.input.iamRoleName },
    TagSpecifications: config.tagSpecifications,
  };

  try {
    const result = await ec2.runInstances(params).promise();
    const ec2InstanceId = result.Instances[0].InstanceId;
    core.info(`A instância EC2 instance ${ec2InstanceId} está em execução`);
    return ec2InstanceId;
  } catch (error) {
    core.error('Deu ruim na criação da instância EC2');
    throw error;
  }
}

async function terminateEc2Instance() {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [config.input.ec2InstanceId],
  };

  try {
    await ec2.terminateInstances(params).promise();
    core.info(`A instância EC2 ${config.input.ec2InstanceId} ja era!`);
    return;
  } catch (error) {
    core.error(`Melou o encerramento da instância EC2 ${config.input.ec2InstanceId}. Passa um pano lá na conta e a remova`);
    throw error;
  }
}

async function waitForInstanceRunning(ec2InstanceId) {
  const ec2 = new AWS.EC2();

  const params = {
    InstanceIds: [ec2InstanceId],
  };

  try {
    await ec2.waitFor('instanceRunning', params).promise();
    core.info(`A instância EC2 ${ec2InstanceId} is pronta para pra você bebê`);
    return;
  } catch (error) {
    core.error(`Você não tratou bem a instância EC2:${ec2InstanceId} e ela te deixou na mão!`);
    throw error;
  }
}

module.exports = {
  startEc2Instance,
  terminateEc2Instance,
  waitForInstanceRunning,
};
