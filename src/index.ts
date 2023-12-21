import axios from 'axios';
import child_process from 'child_process';
import loading from 'loading-cli';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import readline from 'readline';


const homeDir = os.homedir();

const configFilePath = path.join(homeDir, '.config/clog-ai/config.json');

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
  const dirPath = path.dirname(configFilePath);

  if (!fs.existsSync(dirPath)) {
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
  process.exit(0);
}

const config = getConfig()

if (!config.azure_api_key || !config.azure_deployment_id || !config.azure_base_url || !config.azure_model || !config.azure_api_version) {
  console.log('please edit config file: ' + path.resolve(configFilePath))
  process.exit(0);
}

function getConfig() {
  const content = fs.readFileSync(configFilePath).toString();
  return JSON.parse(content || '{}');
}

const TEMPLACE_CN = `
现有以下的 git diff 输出：
<diff>
{{diff}}
</diff>

角色：你是一个根据 git diff 信息生成 git commit log 的工具，你会为一个复杂的变更生成一条精简的 commit log.

以下是 git commit log 的书写前缀及其对应的使用场景：
* feat：新功能（feature）
* fix：修补bug
* docs：文档（documentation）
* style： 格式（不影响代码运行的变动）
* refactor：重构（即不是新增功能，也不是修改bug的代码变动）
* test：增加测试
* chore：构建过程或辅助工具的变动

最终的输出格式：
<output>
前缀: 本次所有变更的简要描述

* 具体描述
</output>

要求：
* 使用中文输出
* 如果有多种类型的修改，也强制压缩到一条 commit log 中，挑选出最重要的更改进行描述
* 描述修改的功能，不描述修改了什么文件，也不描述修改了什么代码

请根据 git diff 的内容，直接给出最终的 commit log，将其包裹在 <output> 和 </output> 标签中即可`;

const TEMPLACE_EN = `
There is the git diff output:
<diff>
{{diff}}
</diff>

Role: You are a tool that generates git commit log based on git diff information.

The following is the prefix of the git commit log and its corresponding usage scenario:
* feat: new feature
* fix: fix bug
* docs: documentation
* style: format (code changes that do not affect the running of the code)
* refactor: refactoring (code changes that are neither new features nor bug fixes)
* test: add test
* chore: changes in the build process or auxiliary tools

The final output format:
<output>
[prefix]: brief description of the change

* description of the modified content
* description of the modified content
...
</output>

Other requirements:
* Start your commit log with the agreed prefix
* Only one commit log is required
* The description of the modified content does not exceed 3

Please give the final commit log directly according to the above requirements, and wrap it in the <output> and </output> tags.`;


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
  const diff = child_process
    .execSync('git diff HEAD')
    .toString()
    .substring(0, 5000);

  const prompt = (config.language == 'zh' ? TEMPLACE_CN : TEMPLACE_EN).replace('{{diff}}', diff)
  const load = loading({
    text: 'Generating commit log...',
    color: 'yellow',
    interval: 100,
    frames: ['◰', '◳', '◲', '◱'],
  }).start();
  try {
    const res = await gptRequestAzure(prompt);

    const commitLog = res.match(/<output>([\s\S]*)<\/output>/)?.[1]?.trim();
    if (!commitLog) {
      throw new Error('No commit log generated');
    }
    load.stop();
    load.succeed('Generate commit log success');
    console.log('-------------------')
    console.log(commitLog);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('-------------------')
    rl.question('Submit git commit with the log? (yes/no) ', (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        child_process.execSync(`git commit -m "${commitLog}"`);
        load.succeed('commit success');
      } else {
      }

      rl.close();
    });


  } catch (e) {
    load.stop();
    load.fail('Generate commit log fail');
    console.error(e.message);
  }
};
