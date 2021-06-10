const core = require('@actions/core');
const github = require('@actions/github');
const _ = require('lodash');
const config = require('./config');

// use the unique label to find the runner
// as we don't have the runner's id, it's not possible to get it in any other way
async function getRunner(label) {
  const octokit = github.getOctokit(config.input.githubToken);

  try {
    const response = await octokit.request('GET /repos/{owner}/{repo}/actions/runners', config.githubContext);
    const foundRunners = _.filter(response.data.runners, { labels: [{ name: label }] });
    return foundRunners.length > 0 ? foundRunners[0] : null;
  } catch (error) {
    return null;
  }
}

// get GitHub Registration Token for registering a self-hosted runner
async function getRegistrationToken() {
  const octokit = github.getOctokit(config.input.githubToken);

  try {
    const response = await octokit.request('POST /repos/{owner}/{repo}/actions/runners/registration-token', config.githubContext);
    core.info('O token de registro do runner tá na mão truta. Tenha fé no GitHub que ele é justo.');
    return response.data.token;
  } catch (error) {
    core.error('O GitHub não passou o token de registro do runner pra nós. Com ele o papo é reto irmão, reveja o seu proceder');
    throw error;
  }
}

async function removeRunner() {
  const runner = await getRunner(config.input.label);
  const octokit = github.getOctokit(config.input.githubToken);

  // skip the runner removal process if the runner is not found
  if (!runner) {
    core.info(`Ae! não achei esse runner ${config.input.label}. Tá me tirando?`);
    return;
  }

  try {
    await octokit.request('DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}', _.merge(config.githubContext, { runner_id: runner.id }));
    core.info(`O runner:${runner.name} agora é finado! Já era.`);
    return;
  } catch (error) {
    core.error('Essa runner é pipoca. Deu ruim parceiro, ele não tá lá no GitHub...');
    throw error;
  }
}

async function waitForRunnerRegistered(label) {
  //TODO: Transformar os limiares de espera do runner em parâmetros da ação
  const timeoutMinutes = 10;
  const retryIntervalSeconds = 10;
  const quietPeriodSeconds = 30;
  let waitSeconds = 0;

  core.info(`Esperando ${quietPeriodSeconds}s pela noivinha EC2 ser registrada como runner no GitHub`);
  await new Promise((r) => setTimeout(r, quietPeriodSeconds * 1000));
  core.info(`A cada ${retryIntervalSeconds}s eu colo na porta pra ver se ela já chegou`);

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      const runner = await getRunner(label);

      if (waitSeconds > timeoutMinutes * 60) {
        core.error('Melou o registro do runner na GitHub! Espiritos zombeteiros?');
        clearInterval(interval);
        reject(
          `Esse runner tá igual noiva dos tempos antigos, atrasando a vida do parceiro já na porta da igreja! Mais que ${timeoutMinutes} minutos já é desaforo`
        );
      }

      if (runner && runner.status === 'online') {
        core.info(`O runner ${runner.name} está registrado no GitHub queridão!`);
        clearInterval(interval);
        resolve();
      } else {
        waitSeconds += retryIntervalSeconds;
        core.info('e lá vamos nós...');
      }
    }, retryIntervalSeconds * 1000);
  });
}

module.exports = {
  getRegistrationToken,
  removeRunner,
  waitForRunnerRegistered,
};
