### Network

NAT - with these forwarded ports

```xml
<Network>
  <Adapter slot="0" enabled="true" MACAddress="080027288EBB" type="82540EM">
    <NAT localhost-reachable="true">
      <Forwarding name="139" proto="1" hostip="0.0.0.0" hostport="139" guestport="139"/>
      <Forwarding name="20" proto="1" hostip="0.0.0.0" hostport="20" guestport="20"/>
      <Forwarding name="21" proto="1" hostip="0.0.0.0" hostport="21" guestport="21"/>
      <Forwarding name="22" proto="1" hostip="0.0.0.0" hostport="22" guestport="22"/>
      <Forwarding name="3000" proto="1" hostip="0.0.0.0" hostport="3000" guestport="3000"/>
      <Forwarding name="32400" proto="1" hostip="0.0.0.0" hostport="32400" guestport="32400"/>
      <Forwarding name="3306" proto="1" hostip="0.0.0.0" hostport="3306" guestport="3306"/>
      <Forwarding name="4000" proto="1" hostip="0.0.0.0" hostport="4000" guestport="4000"/>
      <Forwarding name="443" proto="1" hostip="0.0.0.0" hostport="443" guestport="443"/>
      <Forwarding name="445" proto="1" hostip="0.0.0.0" hostport="445" guestport="445"/>
      <Forwarding name="5000" proto="1" hostip="0.0.0.0" hostport="5000" guestport="5000"/>
      <Forwarding name="5432" proto="1" hostip="0.0.0.0" hostport="5432" guestport="5432"/>
      <Forwarding name="5672" proto="1" hostip="0.0.0.0" hostport="5672" guestport="5672"/>
      <Forwarding name="6000" proto="1" hostip="0.0.0.0" hostport="6000" guestport="6000"/>
      <Forwarding name="6379" proto="1" hostip="0.0.0.0" hostport="6379" guestport="6379"/>
      <Forwarding name="7071" proto="1" hostip="0.0.0.0" hostport="7071" guestport="7071"/>
      <Forwarding name="80" proto="1" hostip="0.0.0.0" hostport="80" guestport="80"/>
      <Forwarding name="8000" proto="1" hostip="0.0.0.0" hostport="8000" guestport="8000"/>
      <Forwarding name="8080" proto="1" hostip="0.0.0.0" hostport="8080" guestport="8080"/>
      <Forwarding name="8096" proto="1" hostip="0.0.0.0" hostport="8096" guestport="8096"/>
      <Forwarding name="9000" proto="1" hostip="0.0.0.0" hostport="9000" guestport="9000"/>
      <Forwarding name="9092" proto="1" hostip="0.0.0.0" hostport="9092" guestport="9092"/>
    </NAT>
  </Adapter>
</Network>
```

### VBOX Guest Addition for Server

- https://linuxize.com/post/how-to-install-virtualbox-guest-additions-on-debian-10/
- https://kifarunix.com/install-virtualbox-guest-additions-on-debian-11/

```bash
sudo apt install build-essential dkms linux-headers-$(uname -r)

sudo mount /dev/cdrom /mnt
cd /mnt

sudo sh ./VBoxLinuxAdditions.run --nox11
```

### Mount host shared folder

https://gist.github.com/estorgio/0c76e29c0439e683caca694f338d4003

#### Mount manually

```
sudo mount -t vboxsf c ~/shared
```

#### Mount persistently

```
# setup the mount point
# /etc/fstab
c	/mnt/c	vboxsf	defaults	0	0
d	/mnt/d	vboxsf	defaults	0	0

# load up this kernel on load
# /etc/modules
vboxsf
```
