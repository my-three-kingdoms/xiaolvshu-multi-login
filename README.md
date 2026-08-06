# Xiaolvshu Multi Login

Windows + Node.js 工具：从 Markdown 账号表中读取手机号，为每个账号启动独立的 Chrome 数据目录，并在 `xiaolvshu.app` 登录页自动完成手机号、短信验证码和法律声明步骤。

## 使用

1. 安装 Node.js 当前 LTS 版本，并确认 `node`、`npm` 可以在终端中运行。
2. 双击 `launch.bat`。
3. 首次运行按提示输入账号 Markdown 文件和 Cookie 数据目录。
4. 每次运行选择本次打开几个账号，以及从第几个账号开始。这里的账号序号从 `1` 开始。
5. 首次登录或 Cookie 失效时输入共享短信验证码；已有有效 Cookie 时可以直接留空。验证码只通过当前进程环境变量传递，不写入配置文件。
6. 关闭 Chrome 窗口后，程序才会退出。再次运行会复用原账号目录中的 Cookie。

账号解析规则是提取文件中出现的独立 11 位数字并去重，保留首次出现顺序。`count` 和 `start` 用于选择本次打开的账号区间。

## 账号文件格式

文件可以是普通 Markdown 表格，姓名和备注不会被使用，工具只读取独立的 11 位数字：

```markdown
| 序号 | 手机号 | 使用人 |
| --- | --- | --- |
| 1 | 13800138000 | 同事 A |
| 2 | 13900139000 | 同事 B |
| 3 | 13700137000 | 同事 C |
```

上面的示例中，选择“打开 `2` 个账号、从第 `2` 个开始”，就会启动账号 2 和账号 3。实际文件中不要把验证码、Cookie 或密码写在账号表里。

## 配置

首次运行会在项目目录生成本地 `config.json`，该文件已被 Git 忽略。也可以复制 `config.example.json` 后手动修改。`profileRoot` 建议放在 `%LOCALAPPDATA%`，不要放进 Git 仓库。

Chrome 默认查找以下位置，也可在 `config.json` 中设置 `chromePath`：

- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
- `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`

## 验证

```powershell
npm install
npm test
npm run check
node src/index.mjs --config config.example.json --dry-run
```

## 安全边界

- 只用于你有权管理的账号；工具不会绕过验证码、权限或站点风控。
- 不要把真实账号文件、验证码、`config.json` 或 Chrome profile 目录提交到仓库。
- Chrome profile 中包含登录 Cookie，等同于登录凭据；需要共享项目时只共享源代码，不共享 profile 目录。
- 关闭窗口不会清除 Cookie。需要重新登录时，手动删除对应 profile 目录。
