"""Capture the unchanged Android game by driving real emulator UI controls."""
from pathlib import Path
import subprocess,time,re,xml.etree.ElementTree as ET
OUT=Path('store-captures');OUT.mkdir(exist_ok=True)
launcher_recovered=False
def adb(*args):
 return subprocess.check_output(['adb',*args])
def snap(name):
 (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
def tree():
 global launcher_recovered
 adb('shell','uiautomator','dump','/sdcard/conduit-ui.xml')
 raw=adb('shell','cat','/sdcard/conduit-ui.xml')
 (OUT/'latest-ui.xml').write_bytes(raw)
 root=ET.fromstring(raw)
 # Recover only the observed disposable emulator launcher ANR, never a CONDUIT crash.
 if not launcher_recovered and any(n.get('text')=="Pixel Launcher isn't responding" for n in root.iter('node')):
  for node in root.iter('node'):
   if node.get('resource-id')=='android:id/aerr_close':
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds','')))
    launcher_recovered=True
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
    adb('shell','am','start','-n','com.oneday1fact.conduit.test/com.oneday1fact.conduit.MainActivity')
    time.sleep(3)
    return tree()
 return root
def tap(label,contains=False):
 for attempt in range(4):
  root=tree()
  nodes=[]
  for node in root.iter('node'):
   values=[node.get('text',''),node.get('content-desc','')]
   if any((label.lower() in v.lower()) if contains else (v.lower()==label.lower()) for v in values):
    bounds=re.findall(r'\d+',node.get('bounds',''))
    if len(bounds)==4:
     x1,y1,x2,y2=map(int,bounds)
     if x2>x1 and y2>y1:nodes.append((node,x1,y1,x2,y2))
  if nodes:
   node,x1,y1,x2,y2=min(nodes,key=lambda n:(n[3]-n[1])*(n[4]-n[2]))
   adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
   time.sleep(.7)
   return
  time.sleep(1)
 snap('error-'+re.sub('[^a-z]+','-',label.lower()))
 raise RuntimeError('Control not found: '+label)
try:
 adb('shell','wm','size','1080x1920')
 adb('shell','wm','density','420')
 adb('shell','settings','put','system','accelerometer_rotation','0')
 adb('shell','settings','put','system','user_rotation','0')
 adb('install','-r','android/app/build/outputs/apk/debug/app-debug.apk')
 adb('shell','svc','wifi','disable')
 adb('shell','svc','data','disable')
 adb('shell','am','start','-n','com.oneday1fact.conduit.test/com.oneday1fact.conduit.MainActivity')
 time.sleep(12)
 snap('00-first-launch')
 tap("Let's play")
 snap('01-daily-puzzle')
 tap('Pro archive')
 snap('06-pro-upgrade')
 tap('Close Pro')
 tap('Sign in')
 snap('07-account-sign-in')
 tap('Close account')
 tap('Practice')
 snap('02-practice-selection')
 tap('Salted Current',contains=True)
 snap('03-practice-puzzle')
 tap('FALL');tap('Slot 1:',contains=True)
 snap('04-puzzle-in-progress')
 tap('BACK');tap('Slot 2:',contains=True)
 tap('FIRE');tap('Slot 3:',contains=True)
 time.sleep(2)
 snap('05-completed-puzzle')
except Exception:
 snap('capture-error')
 raise
finally:
 try:tree()
 except Exception:pass
 (OUT/'capture-provenance.txt').write_text('Actual Android emulator screenshots of CONDUIT debug build from repository source. No game HTML or saved puzzle state was modified for capture. UI actions: close help, select Practice/Salted Current, place FALL/BACK/FIRE. Debug app uses test ads; no ad was requested.\n')
