import axios from 'axios';
import child_process from 'child_process';
import loading from 'loading-cli';
import * as fs from 'fs';
import * as path from 'path';

const configFilePath = '~/.config/clog-ai/config.json';

const param = process.argv[2];
const command = param?.trim();
if (command == 'init') {
  if (fs.existsSync(configFilePath)) {
    console.log(
      'config file already exists, please edit config file: ' +
        path.resolve(configFilePath)
    );
    process.exit(0);
  }
  const config = {
    language: 'zh',
    azure_api_key: '',
    azure_deployment_id: '',
    azure_base_url: '',
    azure_model: '',
    azure_api_version: '',
  };
  // 使用 path 模块获取文件的目录路径
  const dirPath = path.dirname(configFilePath);

  // 检查目录是否存在，如果不存在则创建它
  if (!fs.existsSync(dirPath)) {
    // recursive: true 选项会确保创建所有必需的父目录
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
  console.log(
    'init success, please edit config file: ' + path.resolve(configFilePath)
  );
  process.exit(0);
}

if (!fs.existsSync(configFilePath)) {
  console.log('please run this command first: clog-ai init');
}

const config = getConfig() || {
  language: 'zh',
};

function getConfig() {
  const content = fs.readFileSync(configFilePath).toString();
  return JSON.parse(content || '{}');
}

const TEMPLACE_CN = `
现有以下的 git diff 输出：
<diff>
{{diff}}
</diff>

角色：你是一个根据 git diff 信息生成 git commit log 的工具.

要求：
以下是 git commit log 的书写前缀及其对应的使用场景：
* feat：新功能（feature）
* fix：修补bug
* docs：文档（documentation）
* style： 格式（不影响代码运行的变动）
* refactor：重构（即不是新增功能，也不是修改bug的代码变动）
* test：增加测试
* chore：构建过程或辅助工具的变动

最终的输出格式：
[前缀]: 变更的简要中文描述

* 修改内容的中文描述
* 修改内容的中文描述
...

请按照以上要求直接给出最终的 commit log`;

const TEMPLACE_EN = `
There is the git diff output:
<diff>
{{diff}}
</diff>

You are a tool to generate git commit log based on git diff information, and your name is ai-commit-log.

Requirements:
The following is the prefix of git commit log and its corresponding meaning:
* feat: new feature
* fix: fix bug
* docs: documentation
* style: format (code changes that do not affect the running of the code)
* refactor: refactoring (code changes that are neither new features nor bug fixes)
* test: add test
* chore: changes in the build process or auxiliary tools

Other requirements:
1. Please use the above prefix to start your commit log
2. The content should be concise, and the core function modification of the local modification should be clearly described
3. Please use English to describe

The final output format:
[prefix]: brief description

* Modify content one
* Modify content two
...

Please follow the above requirements and generate commit log based on the above git diff output:`;


async function gptRequestAzure(prompt: string) {
  const res = await axios.post(
    `${config.azure_base_url}/openai/deployments/${config.azure_deployment_id}/chat/completions?api-version=${config.azure_api_version}`,
    {
      model: 'gpt-3.5-turbo-16k',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    },
    {
      headers: {
        'api-key': config.azure_api_key,
      },
      timeout: 100000,
    }
  );
  return res.data.choices[0].message.content;
}

export default async () => {
  // 执行 git diff，获取变更的文件内容
  const diff =  child_process
    .execSync('git diff HEAD')
    .toString()
    .substring(0, 5000);

  const prompt =  (config.language == 'zh' ? TEMPLACE_CN : TEMPLACE_EN).replace('{{diff}}', diff)
  const load = loading({
    text: 'Generating commit log...',
    color: 'yellow',
    interval: 100,
    frames: ['◰', '◳', '◲', '◱'],
  }).start();
  try {
    const res = await gptRequestAzure(prompt);

    load.stop();
    load.succeed('Generate commit log success');
    console.log(res);
    if(command == 'commit'){
      console.log('commiting...');
      child_process.execSync(`git commit -m "${res}"`);
    }
  } catch (e) {
    load.stop();
    load.fail('Generate commit log fail');
    console.error(e.message);
  }
};
