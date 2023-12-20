# clog-ai

## Example

示例可参照本项目的 commit log

## Installation

```bash
npm install -g ai-commit-log
```

## Usage

```bash
clog-ai init
```

then edit config file:

```
{
  "language": "zh or en",
  "azure_api_key": "xxxxx",
  "azure_deployment_id": "xxxx",
  "azure_base_url": "https://xxxxxxx.openai.azure.com",
  "azure_model": "gpt-3.5-turbo-16k",
  "azure_api_version": "2023-07-01-preview",
}
```

## Run

```bash
git add . # git add files

clog-ai # generate commit log only
clog-ai commit # generate commit log and git commit 
```

## Azure api

https://portal.azure.com/
