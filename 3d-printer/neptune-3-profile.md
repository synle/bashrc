- https://ultimaker.com/software/ultimaker-cura
- https://www.reddit.com/r/ElegooNeptune3/comments/ykh9ri/psa_official_cura_52_profiles_on_github_neptune_3/
- https://github.com/NARUTOfzr/Cura5.0-Neptune-TEST
- https://github.com/NARUTOfzr/Cura5.0-Neptune-TEST/archive/refs/heads/main.zip

### Settings
#### Printer Settings
```
X 235
Y 235
Z 285
Rectangular
Heated Bed
Gcode Flavor: Marlin
```

#### Printer Settings
```
X Min -20
Y Min -10
X Max 10
Y Max 10
Gantry Height 285
Number of Extruder 1
```

#### Extruder 1 - Nozzle Settings
```
Nozzle Size 0.4
Compatible Material Diameter 1.75
Nozzle X offset 0
Nozzle Y offset 0
Cooling Fan Number 0
```


### Start G-Code
```
G28 ;home
G92 E0 ;Reset Extruder
G1 Z4.0 F3000 ;Move Z Axis up
G92 E0 ;Reset Extruder
G1 X1.1 Y20 Z0.28 F5000.0 ;Move to start position
G1 X1.1 Y80.0 Z0.28 F1500.0 E10 ;Draw the first line
G1 X1.4 Y80.0 Z0.28 F5000.0 ;Move to side a little
G1 X1.4 Y20 Z0.28 F1500.0 E20 ;Draw the second line
G92 E0 ;Reset Extruder
G1 Z2.0 F3000 ;Move Z Axis up
```

### End G-Code
```
G91 ;Relative positionning
G1 E-2 F2700 ;Retract a bit
G1 E-2 Z0.2 F1600 ;Retract and raise Z
G1 X5 Y5 F3000 ;Wipe out
G1 Z10 ;Raise Z more
G90 ;Absolute positionning
G1 X0 Y{machine_depth} ;Present print
M106 S0 ;Turn-off fan
M104 S0 ;Turn-off hotend
M140 S0 ;Turn-off bed
M84 X Y E ;Disable all steppers but Z
```


### Automatic script

https://www.reddit.com/r/3Dprinting/comments/ww94cb/official_elegoo_neptune_3_cura_machine_profile/

```bash
# run as admin "Windows Terminal"
mkdir -p /tmp/elegoo
cd /tmp/elegoo
curl https://gist.githubusercontent.com/unraze/f8bf62300ed6ec6cda4a40c3d5b3d04b/raw/b5c6c159f2f62ab978cf885da614f9f12ddc7c8b/custom_extruder_9.def.json -o custom_extruder_9.def.json
curl https://gist.githubusercontent.com/unraze/0258a610a50ec12c4f5a1ded2920f6d2/raw/f60d379b435bfc92095946c0acb178581fd32888/custom_extruder_10.def.json -o custom_extruder_10.def.json
curl https://gist.githubusercontent.com/unraze/77e6cf15b3074d7d05e5b6ce1e53cc40/raw/2fbea81640de848fc1c69a5324c9c27427103d65/elegoo_neptune_3.def.json -o elegoo_neptune_3.def.json

cd /mnt/c/Program\ Files/Ultimaker\ Cura\ */share/cura/resources/extruders
mv /tmp/elegoo/custom_extruder_9.def.json ./
mv /tmp/elegoo/custom_extruder_10.def.json ./

cd /mnt/c/Program\ Files/Ultimaker\ Cura\ */share/cura/resources/definitions
mv /tmp/elegoo/elegoo_neptune_3.def.json ./
```
