# Remove Android Bloats

```


######################################################################################
######################################################################################
### Core Commands
pm disable-user --user 0  _some_package_
pm uninstall -k --user 0 _some_package_
pm list packages -d
adb shell cmd package install-existing _some_package_


######################################################################################
######################################################################################
###### Other commands
settings list system
settings list global
settings list secure

### All packages:
dumpsys package | grep "Package \[" | cut -d "\[" -f2 | cut -d "\]" -f1
pm list packages | cut -d ":" -f2

###### safe to remove
```
