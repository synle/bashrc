Environment Variables
```
C:\Program Files\Java\jdk-11.0.1\bin
%USERPROFILE%\AppData\Local\Android\sdk\platform-tools
```

### WSL not loading
Error: 0x800703fa Illegal operation attempted on a registry key that has been marked for deletion

```
sc stop lxssmanager
sc start lxssmanager
```


### WSL Terminal Tweaks
https://blog.ropnop.com/configuring-a-pretty-and-usable-terminal-emulator-for-wsl/

xming - https://sourceforge.net/projects/xming/

```
dbus-uuidgen > /tmp/machine-id && sudo mv /tmp/machine-id /etc/machine-id

sudo apt-get install terminator dbus-x11

DISPLAY=:0 terminator &

args = "-c" & " -l " & """DISPLAY=:0 terminator"""
WScript.CreateObject("Shell.Application").ShellExecute "bash", args, "", "open", 0

C:\Windows\System32\wscript.exe %HOMEPATH%\startTerminator.vbs
%USERPROFILE%
```


### Chrome Flags
Source: https://www.maketecheasier.com/chrome-flags-better-browsing-experience/

```
Enable picture in picture
Omnibox UI Vertical Layout - SHOW Title
Automatic Tab Discarding - DISCARD
Smooth Scrolling - OFF
Tab audio muting UI control - MUTE TAB
Fast tab/window close - QUICK TAB CLOSE
```



#### Register SSH key
#####
```
sudo crontab -e
*/20 * * * * /opt/cron_pull_code.sh
```
##### Script
```
eval $(ssh-agent);
ssh-add ~/.ssh/id_rsa;

cd your_app
git pull
```



#### Sample config for eslint and prettier
```
"lint": "./node_modules/.bin/eslint --ignore-pattern \"*.spec.js\" --max-warnings 200 src/**/**/*.js",
"format": "./node_modules/.bin/prettier --config ./.prettierrc --write src/**/**/*{js,jsx}"
```

```
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


### XARGS and Sed
```
find src -name "*.bak" | xargs rm && find src -name "*.DS_Store" | xargs rm
find src -type f -name "*.js" -exec sed -i'.bak' -e 's/allowTotalAmountChangedSelectors/allowTotalAmountChanged/g' {} \;
```


### Create self-signed certs
https://letsencrypt.org/docs/certificates-for-localhost/
```
openssl req -x509 -out localhost.crt -keyout localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```


### Portforwarding
https://www.booleanworld.com/guide-ssh-port-forwarding-tunnelling/

#### Local port forwarding
From SSH Server to localhost
```
ssh -L 443:localhost:443 -L 3000:localhost:3000 -L 9000:localhost:9000 -L 3306:localhost:3306 sy-macpro
```

If you do not need to start a session, you can add -N
```
ssh -L 443:localhost:443 -L 3000:localhost:3000 -L 9000:localhost:9000 -L 3306:localhost:3306 -N sy-macpro
```

#### Remote port forwarding
From localhost to SSH Server
```
ssh -R 7000:127.0.0.1:8000 user@example.com
```

### Copy SSH keys
```
ssh-copy-id syle@sy-macpro
```


### Connect to SSH with private key
```
ssh -i .ssh/id_rsa
```

### SSH Config file
~/.ssh/config
```
Host sy-macpro
  User syle
  HostName 192.168.5.2
  IdentityFile ~/.ssh/id_rsa
```


#### Generate key in Windows with Putty
Download puttygen (putty)
- Save public key
- Save private key `ppk`

Also can use puttygen to convert `aws key`     to `ppk`

#### Connect with Putty private key
Connection > Auth > Choose private key `ppk`


#### awk cheatsheet
```
awk '{print $1 $2}` contacts.txt

# print number of fields, then whole line ($0)
awk '{print NF $0}` contacts.txt 

# only print those lines that matches `Bob`
awk '/Bob/{print $1 $2}` contacts.txt

# only print those lines with 3 fields
awk 'NF==3{print $0}` contacts.txt

# only print those lines with 3 fields
awk '/up/{print "UP:" $0}` '/down/{print "DOWN:" $0}` contacts.txt

# from command file
awk -f filename contacts.txt

# use space as field seperator here we seperate by \t
awk -F '\t' '{print $2}' contacts.txt

# csv to tsv
awk 'BEGIN{FS=",": OFS="\t"}' '{print $1 $2 $3}' contacts.csv
awk 'BEGIN{FS=",": OFS="\t"}' '{print $1 $2 $3}' contacts.csv
```

### SSH Connection Alive longer
`sudo vim /etc/ssh/ssh_config`

```
Host *
  ClientAliveInterval 120
  ClientAliveCountMax 720
```


### MYSQL
#### Datetime and Timezone
```
SHOW VARIABLES LIKE '%time_zone%'

SET time_zone = '+00:00';
SELECT NOW(); -- with respect to server timezone
SELECT UTC_TIMESTAMP(); 
```

```
TIMESTAMP type is obsolette and will stop working in years 2038
update_current_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### Enum type
##### Using Enum
```
...
city ENUM ('SF', 'LA', 'NY')
...

INSERT INTO test (...) VALUES ('SF');
INSERT INTO test (...) VALUES ('1');
```

##### Using Set
Bitmap position
```
...
city SET ('SF', 'LA', 'NY')
...

INSERT INTO test (...) VALUES ('SF,LA');
INSERT INTO test (...) VALUES ('1');
```
#### Serial data type
```
id SERIAL
...
id INT UNSIGNED UNIQUE AUTO_INCREMENT PRIMARY KEY
```


### Describe / Show Create Table
```
DESCRIBE test
SHOW CREATE TABLE test
```

#### Numeric Data Types
Use DECIMAL for precision
```
DECIMAL(9,2) -- 1234567.89
DECIMAL(10,0) -- 1234567890
```

Not precised
```
FLOAT - 24 bits and 7 precision - about 7 digits
DOUBLE - 53 bits and 16 precision - about 16 digits
```


### VS Code - Note on Remote Development
https://code.visualstudio.com/docs/remote/ssh
