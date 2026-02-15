# Notes

## Environment Variables

```
C:\Program Files\Java\jdk-11.0.1\bin
%USERPROFILE%\AppData\Local\Android\sdk\platform-tools
```

## WSL

### WSL Not Loading

Error: `0x800703fa Illegal operation attempted on a registry key that has been marked for deletion`

```bash
sc stop lxssmanager
sc start lxssmanager
```

### WSL Terminal Tweaks

Reference: <https://blog.ropnop.com/configuring-a-pretty-and-usable-terminal-emulator-for-wsl/>

xming - <https://sourceforge.net/projects/xming/>

```bash
dbus-uuidgen > /tmp/machine-id && sudo mv /tmp/machine-id /etc/machine-id

sudo apt-get install terminator dbus-x11

DISPLAY=:0 terminator &

args = "-c" & " -l " & """DISPLAY=:0 terminator"""
WScript.CreateObject("Shell.Application").ShellExecute "bash", args, "", "open", 0

C:\Windows\System32\wscript.exe %HOMEPATH%\startTerminator.vbs
%USERPROFILE%
```

## Chrome Flags

Source: <https://www.maketecheasier.com/chrome-flags-better-browsing-experience/>

```
Enable picture in picture
Omnibox UI Vertical Layout - SHOW Title
Automatic Tab Discarding - DISCARD
Smooth Scrolling - OFF
Tab audio muting UI control - MUTE TAB
Fast tab/window close - QUICK TAB CLOSE
```

## SSH

### Register SSH Key

```bash
sudo crontab -e
*/20 * * * * /opt/cron_pull_code.sh
```

#### Script

```bash
eval $(ssh-agent);
ssh-add ~/.ssh/id_rsa;

cd your_app
git pull
```

### Copy SSH Keys

```bash
ssh-copy-id syle@sy-macpro
```

### Connect to SSH with Private Key

```bash
ssh -i .ssh/id_rsa
```

### SSH Config File

`~/.ssh/config`

```
Host sy-macpro
  User syle
  HostName 192.168.5.2
  IdentityFile ~/.ssh/id_rsa
```

### SSH Connection Keep Alive

`sudo vim /etc/ssh/ssh_config`

```
Host *
  ClientAliveInterval 120
  ClientAliveCountMax 720
```

### Generate Key in Windows with PuTTY

Download puttygen (putty):

- Save public key
- Save private key `.ppk`

Also can use puttygen to convert AWS key to `.ppk`.

### Connect with PuTTY Private Key

Connection > Auth > Choose private key `.ppk`

## Port Forwarding

Reference: <https://www.booleanworld.com/guide-ssh-port-forwarding-tunnelling/>

### Local Port Forwarding

From SSH Server to localhost:

```bash
ssh -L 443:localhost:443 -L 3000:localhost:3000 -L 9000:localhost:9000 -L 3306:localhost:3306 sy-macpro
```

If you do not need to start a session, you can add `-N`:

```bash
ssh -L 443:localhost:443 -L 3000:localhost:3000 -L 9000:localhost:9000 -L 3306:localhost:3306 -N sy-macpro
```

### Remote Port Forwarding

From localhost to SSH Server:

```bash
ssh -R 7000:127.0.0.1:8000 user@example.com
```

## ESLint and Prettier Config

```json
"lint": "./node_modules/.bin/eslint --ignore-pattern \"*.spec.js\" --max-warnings 200 src/**/**/*.js",
"format": "./node_modules/.bin/prettier --config ./.prettierrc --write src/**/**/*{js,jsx}"
```

```json
{
  "printWidth": 100,
  "parser": "flow",
  "semi": true,
  "useTabs": false,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "jsxBracketSameLine": true,
  "jsxSingleQuote": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

## Shell Utilities

### xargs and sed

```bash
find src -name "*.bak" | xargs rm && find src -name "*.DS_Store" | xargs rm
find src -type f -name "*.js" -exec sed -i'.bak' -e 's/allowTotalAmountChangedSelectors/allowTotalAmountChanged/g' {} \;
```

### awk Cheatsheet

```bash
awk '{print $1 $2}' contacts.txt

# print number of fields, then whole line ($0)
awk '{print NF $0}' contacts.txt

# only print those lines that match 'Bob'
awk '/Bob/{print $1 $2}' contacts.txt

# only print those lines with 3 fields
awk 'NF==3{print $0}' contacts.txt

# only print those lines with 3 fields
awk '/up/{print "UP:" $0}' '/down/{print "DOWN:" $0}' contacts.txt

# from command file
awk -f filename contacts.txt

# use space as field separator here we separate by \t
awk -F '\t' '{print $2}' contacts.txt

# csv to tsv
awk 'BEGIN{FS=","; OFS="\t"}{print $1, $2, $3}' contacts.csv
```

## Self-Signed Certificates

Reference: <https://letsencrypt.org/docs/certificates-for-localhost/>

```bash
openssl req -x509 -out localhost.crt -keyout localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

## MySQL

### Datetime and Timezone

```sql
SHOW VARIABLES LIKE '%time_zone%'

SET time_zone = '+00:00';
SELECT NOW(); -- with respect to server timezone
SELECT UTC_TIMESTAMP();
```

```sql
-- TIMESTAMP type is obsolete and will stop working in year 2038
update_current_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

### Enum Type

#### Using Enum

```sql
...
city ENUM ('SF', 'LA', 'NY')
...

INSERT INTO test (...) VALUES ('SF');
INSERT INTO test (...) VALUES ('1');
```

#### Using Set

Bitmap position:

```sql
...
city SET ('SF', 'LA', 'NY')
...

INSERT INTO test (...) VALUES ('SF,LA');
INSERT INTO test (...) VALUES ('1');
```

### Serial Data Type

```sql
id SERIAL
...
id INT UNSIGNED UNIQUE AUTO_INCREMENT PRIMARY KEY
```

### Describe / Show Create Table

```sql
DESCRIBE test
SHOW CREATE TABLE test
```

### Numeric Data Types

Use DECIMAL for precision:

```sql
DECIMAL(9,2) -- 1234567.89
DECIMAL(10,0) -- 1234567890
```

Not precise:

```
FLOAT - 24 bits and 7 precision - about 7 digits
DOUBLE - 53 bits and 16 precision - about 16 digits
```

## VS Code - Remote Development

Reference: <https://code.visualstudio.com/docs/remote/ssh>
