"""Add 1,000 deterministic, uniquely solvable chains and balance future daily repeats.
Usage: python3 scripts/expand-daily-library.py INPUT OUTPUT
The input must be the 800-puzzle library. Existing dates through 2026-10-30 are frozen.
No player data is read or modified. Closed compounds only; no phrases/hyphenated links.
"""
import collections,datetime,hashlib,itertools,json,random,sys
from pathlib import Path
rng=random.Random(20261030)
data=json.loads(Path(sys.argv[1]).read_text())
assert len(data['puzzles'])==800, 'Use the original 800-puzzle input, never expand an expanded file.'
# Explicit word boundaries avoid ambiguous automated compound splitting.
PAIRS='''
AIR PORT;AIR LINE;AIR MAIL;AIR FIELD;AIR SHIP;AIR SPACE;AIR WAY;AIR CRAFT
AIR FLOW;AIR TIME;AIR LIFT;AIR STRIP;PORT HOLE;HOLE SALE
MAIL BOX;MAIL MAN;MAIL BAG;BOX CAR;BOX WOOD;CAR POOL;CAR LOAD;CAR PORT
POOL SIDE;POOL ROOM;SIDE BOARD;SIDE CAR;SIDE KICK;SIDE STEP;SIDE TRACK
STEP LADDER;STEP CHILD;LADDER BACK;TRACK SIDE;TRACK SUIT;SUIT CASE
CASE LOAD;CASE WORK;CASE BOOK;BOOK SHOP;BOOK STORE;BOOK MARK;BOOK END
STORE ROOM;STORE HOUSE;HOUSE TOP;HOUSE WIFE;HOUSE WARMING;HOUSE CAT
CAT FISH;CAT NAP;CAT WALK;CAT TAIL;FISH BOWL;FISH POND;FISH TAIL;FISH HOOK
HOOK WORM;WORM WOOD;WOOD LAND;WOOD PILE;WOOD SHED;WOOD WORK;WOOD WIND
WIND FALL;WIND BREAK;WIND PIPE;WIND STORM;STORM CLOUD;STORM WATER
CLOUD BURST;CLOUD LAND;BURST PIPE
PIPE DREAM;PIPE WORK;DREAM LAND;DREAM BOAT;BOAT HOUSE;BOAT YARD
YARD ARM;ARM REST;ARM LOAD;REST ROOM;ROOM FUL
REST STOP;STOP WATCH;STOP LIGHT;STOP OVER;WATCH DOG;WATCH MAN;DOG HOUSE
DOG WOOD;DOG FISH;DOG FIGHT;FIGHT BACK;BACK STOP;BACK LOG;BACK SIDE
BACK STAGE;BACK DOOR;BACK GROUND;BACK TRACK;BACK HAND;BACK WASH
STAGE HAND;STAGE COACH;COACH LOAD;HAND MADE;HAND WORK;HAND CRAFT
HAND RAIL;HAND SHAKE;HAND CUFF;HAND STAND;STAND PIPE;STAND POINT
POINT BLANK;BLANK ET
DOOR BELL;DOOR STEP;DOOR WAY;DOOR KNOB;BELL BOY;BELL HOP
HOP SCOTCH;SCOTCH TAPE;TAPE WORM;TAPE LINE;LINE BACKER;LINE UP
UP TURN;UP HILL;UP LAND;UP LIFT;UP BEAT;UP KEEP;UP SHOT;UP STAGE
TURN TABLE;TURN COAT;TURN OVER;TABLE TOP;TABLE SPOON;TOP SOIL;TOP COAT
TOP KNOT;TOP SIDE;SOIL WORK
OVER FLOW;OVER CAST;OVER TURN;OVER PASS;OVER RIDE;OVER GROWTH;OVER HANG
FLOW CHART;CHART ROOM;PASS WORD;PASS PORT;WORD PLAY;WORD BOOK
PLAY GROUND;PLAY HOUSE;PLAY MATE;PLAY THING;PLAY TIME;TIME TABLE
TIME LINE;TIME PIECE;TIME KEEP ER;TIME OUT;TIME WORK
OUT HOUSE;OUT DOOR;OUT BREAK;OUT BURST;OUT CAST;OUT FIT;OUT FLOW
OUT GROWTH;OUT LET;OUT LINE;OUT LOOK;OUT POST;OUT PUT;OUT RUN;OUT SHINE
POST BOX;POST CARD;POST MARK;POST MAN;CARD BOARD;BOARD GAME
GAME PLAN;GAME PLAY;PLAN E
BATH ROOM;BATH TUB;BATH WATER;TUB FUL;BATH ROBE;ROBE WARD
WATER MARK;WATER LINE;WATER FRONT;WATER LOG;WATER SHED;WATER FOWL
WATER PROOF;WATER WAY;FRONT DOOR;FRONT LINE;FRONT PAGE;PAGE BOY
PROOF READ;READ OUT;READ ER
BREAD BOARD;BREAD CRUMB;BREAD LINE;BREAD WINNER;CRUMB LE
BUTTER CUP;BUTTER FAT;BUTTER SCOTCH;CUP FUL;CUP BOARD
SUN SET;SUN RISE;SUN DIAL;SUN ROOF;SUN SPOT;SUN SHINE;SUN BURN
SUN SCREEN;MOON RISE;MOON SET;MOON LIT;STAR DUST;STAR LIGHT
DUST BIN;DUST PAN;DUST STORM;PAN CAKE;CAKE WALK;WALK OVER
SNOW DROP;SNOW DRIFT;SNOW STORM;SNOW SHOE;SNOW PLOW;SNOW FLAKE
SNOW FIELD;RAIN STORM;RAIN DROP;RAIN FOREST;RAIN PROOF;FOREST LAND
FIELD MOUSE;FIELD STONE;FIELD TRIP;STONE WALL;STONE WORK;STONE WARE
WALL PAPER;WALL FLOWER;WALL BOARD;PAPER WEIGHT;PAPER CLIP;PAPER BOARD
WEIGHT LIFT;LIFT GATE;GATE WAY;GATE HOUSE;GATE KEEPER
GOLD FISH;GOLD MINE;GOLD DUST;GOLD FIELD;MINE FIELD;MINE SHAFT
SILVER FISH;SILVER WARE;SILVER SMITH;BLACK SMITH;BLACK BOARD
BLACK JACK;BLACK OUT;BLACK TOP;BLACK HEAD;BLACK LIST;HEAD LINE
HEAD LAND;HEAD ROOM;HEAD REST;HEAD STONE;HEAD STRONG;HEAD WAY
HEAD WATER;HEAD QUARTERS;QUARTER BACK;QUARTER DECK;DECK HAND
SHIP BOARD;SHIP WRECK;SHIP LOAD;SHIP SHAPE;SHIP WRIGHT
SEA HORSE;SEA BIRD;SEA WEED;SEA BED;SEA WALL;SEA SHELL;SEA SCAPE
SHELL FISH;SHELL SHOCK;SHOCK WAVE;WAVE LENGTH;LENGTH WISE
RIVER SIDE;RIVER FRONT;RIVER MOUTH;MOUTH PIECE;MOUTH WASH;MOUTH FUL
TOOTH PICK;TOOTH ACHE;TOOTH MARK;PICK POCKET;PICK AXE;POCKET BOOK
POCKET WATCH;POCKET KNIFE;KNIFE POINT;PIN POINT;PIN WHEEL;PIN CUSHION
WHEEL BASE;BASE BALL;BASE LINE;BASE MENT;BALL POINT;BALL PEN
PEN NAME;NAME SAKE;NAME PLATE;PLATE FUL;PLATE GLASS;GLASS HOUSE
GLASS WARE;GLASS WORK;WORK PLACE;WORK TABLE;WORK SHEET;WORK OUT
WORK SPACE;SPACE CRAFT;SPACE SHIP;CRAFT WORK;SHEET MUSIC
MUSIC BOX;MUSIC AL;FOOT BALL;FOOT HOLD;FOOT PATH;FOOT STEP
FOOT BRIDGE;FOOT HILL;FOOT LIGHT;FOOT REST;BRIDGE HEAD;BRIDGE WORK
HILL SIDE;HILL TOP;HILL COUNTRY;COUNTRY SIDE;COUNTRY MAN
COUNTRY WIDE;WIDE SPREAD;SPREAD SHEET;BED ROOM;BED ROCK;BED SIDE
BED TIME;BED SPREAD;ROCK FISH;ROCK FALL;ROCK SLIDE;ROCK POOL
LAND LORD;LAND LADY;LAND FILL;LAND FORM;LAND MASS;LAND OWNER
LAND SCAPE;LAND MARK;LAND SLIDE;LAND LOCK;LOCK SMITH;LOCK UP
KEY BOARD;KEY STONE;KEY NOTE;KEY WAY;NOTE WORTHY;NOTE PAPER
DAY TIME;DAY DREAM;DAY CARE;DAY LONG;NIGHT TIME;NIGHT GOWN;NIGHT SHADE
NIGHT LIGHT;NIGHT WATCH;NIGHT CAP;CAP STONE;CAP SIZE
FIRE SIDE;FIRE PLACE;FIRE PROOF;FIRE STORM;FIRE FIGHTER;FIRE ARM
FIRE HOUSE;FIRE BOX;FIRE WALL;FIRE FLY;LIGHT WEIGHT;LIGHT HOUSE
LIGHT SHIP;LIGHT PROOF;LIGHT YEAR;YEAR BOOK;YEAR LONG
GREEN HOUSE;GREEN WOOD;GREEN FIELD;GREEN BACK;GREEN ROOM
BLUE BIRD;BLUE BERRY;BLUE PRINT;BLUE GRASS;GRASS LAND;GRASS HOPPER
GRASS ROOTS;ROOT STOCK;STOCK ROOM;STOCK PILE;STOCK YARD
STOCK FISH;STOCK BROKER;BROKER AGE;AGE LONG
HONEY BEE;HONEY COMB;HONEY DEW;DEW DROP;DROP LET;DROP DOWN
DROP OUT;DOWN CAST;DOWN LOAD;DOWN POUR;DOWN STREAM;DOWN TOWN
STREAM BED;STREAM LINE;STREAM SIDE;TOWN HOUSE;TOWN SHIP;TOWN SCAPE
FARM HOUSE;FARM YARD;FARM LAND;FARM HAND;FARM WORK
BARN YARD;BARN STORM;BARN DOOR;CORN FIELD;CORN FLAKE;CORN MEAL
CORN STALK;MEAL TIME;MEAL WORM;TEA SPOON;TEA POT;TEA CUP
TEA TIME;TEA ROOM;TEA CAKE;CROSS ROAD;CROSS WALK;CROSS BOW
CROSS WORD;CROSS FIRE;CROSS BAR;ROAD BLOCK;ROAD SIDE;ROAD WORK
ROAD WAY;ROAD BED;ROAD HOUSE;ROAD RUNNER;BAR CODE;BAR TENDER
CODE WORD;SAND BOX;SAND STONE;SAND BAR;SAND PAPER;SAND STORM
SAND BANK;BANK ROLL;BANK NOTE;CHECK BOOK;CHECK POINT;CHECK LIST
CHECK MATE;CHECK MARK;MARK DOWN;MARK UP;SIGN POST;SIGN BOARD
SIGN PAINTER;PAINT BRUSH;BRUSH WORK;BRUSH WOOD;BRUSH FIRE
HAIR BRUSH;HAIR CUT;HAIR LINE;HAIR PIN;HAIR SPRAY;HAIR BAND
CUT BACK;CUT OUT;CUT THROAT;CUT WORK;BAND STAND;BAND WAGON
WAGON LOAD;LOAD STAR;LODE STAR;WISH BONE;BONE MEAL;BONE FISH
LIFE BOAT;LIFE LINE;LIFE TIME;LIFE WORK;LIFE GUARD;GUARD HOUSE
GUARD RAIL;RAIL ROAD;RAIL WAY;RAIL CAR;RAIL HEAD;RAIL SIDE
TOOL BOX;TOOL KIT;TOOL SHED;TOOL BAR;KIT BAG;BAG PIPE
NEWS PAPER;NEWS ROOM;NEWS REEL;NEWS CAST;CAST AWAY;AWAY DAY
EYE SIGHT;EYE WITNESS;EYE GLASS;EYE BROW;EYE LASH;EYE BALL
SIGHT SEEING;SIGHT LINE;SIGHT READ;BALL ROOM;ROOM MATE
RAIN BOW;BOW STRING;BOW MAN;STRING BEAN;BEAN STALK;BEAN BAG
FINGER PRINT;FINGER NAIL;FINGER TIP;TIP TOP;TIP OFF;OFF CUT
OFF SPRING;OFF SHORE;SPRING BOARD;SPRING TIME;SPRING TIDE
TIDE WATER;TIDE WAY;RED WOOD;RED HEAD;RED COAT;RED WING
WING SPAN;WING TIP;SPAN WORM;DRAGON FLY;DRAGON HEAD
DRY DOCK;DRY LAND;DOCK YARD;DOCK SIDE;SIDE SHOW;SHOW CASE
SHOW ROOM;SHOW BOAT;SHOW DOWN;SHOW TIME
'''
# Remove non-lexical token splits, phrases and questionable compounds explicitly.
OMIT={'holesale','burstpipe','roomful','blanket','soilwork','timekeeper','timework','plane','tubful','robeward','reader','crumble','weightlift','basement','musical','brokerage','agelong','lodestar','loadstar','awayday','roomful','cupful','mouthful','plateful','hillcountry','eyeglass','forestland','cloudland','reststop','sheetmusic','musicbox','gameplan','penname','sightread','shockwave','housecat','capsize','spanworm'}
edges=set()
for p in data['puzzles']:
 edges.update(zip(p['chain'],p['chain'][1:]))
for item in PAIRS.split(';'):
 words=item.split()
 if len(words)==2 and ''.join(words).lower() not in OMIT:edges.add(tuple(words))
approved=set(data['approvedCompounds'])|{(a+b).lower() for a,b in edges}
adj=collections.defaultdict(set)
for a,b in edges:adj[a].add(b)
all_chains=[]
def visit(chain):
 if len(chain)==5:all_chains.append(tuple(chain));return
 for b in sorted(adj[chain[-1]]):
  if b not in chain:visit(chain+[b])
for a in sorted(adj):visit([a])
existing={tuple(p['chain']) for p in data['puzzles']}
def links(c):return tuple((a+b).lower() for a,b in zip(c,c[1:]))
def solutions(c,bank):
 return sum(all((a+b).lower() in approved for a,b in zip((c[0],)+middle,middle+(c[-1],))) for middle in itertools.permutations(bank,3))
candidates=[c for c in all_chains if c not in existing and solutions(c,c[1:4])==1]
rng.shuffle(candidates)
print('Candidate unique chains:',len(candidates),flush=True)
# Select additions using compound frequency, with new vocabulary preferred.
usage=collections.Counter(w for p in data['puzzles'] for w in links(p['chain']))
words=sorted({w for e in edges for w in e});new=[];names={p['name'] for p in data['puzzles']}
HINTS={
 'Coastal':'SEA SHORE SHELL SHIP BOAT SAND TIDE DOCK WAVE PORT',
 'Woodland':'WOOD FOREST TREE BIRD GREEN BARN WORM',
 'Celestial':'SUN MOON STAR SPACE LIGHT NIGHT SKY',
 'Kitchen':'TEA CUP CAKE BREAD BUTTER HONEY CORN MEAL SPOON',
 'Literary':'BOOK PAPER NOTE PEN WORD NEWS PRINT PAGE',
 'Railway':'RAIL ROAD CAR TRACK TRAIN LINE WAY',
 'Garden':'GRASS FLOWER ROOT SOIL BEAN GREEN DEW',
 'Mountain':'HILL ROCK STONE LAND SNOW FALL',
 'Waterside':'RIVER WATER STREAM POOL FISH BANK POND',
 'Workshop':'WORK TOOL BRUSH CRAFT SHED BOX KIT',
 'Sporting':'BALL FIELD GAME PLAY FOOT NET CLUB',
 'Homeward':'HOUSE ROOM BED DOOR BATH WALL MATE',
 'Wilderness':'HORSE DOG CAT DRAGON BIRD WING TAIL',
 'City':'TOWN STAGE STORE SHOP BLOCK POST SIGN CODE',
 'Weather':'RAIN WIND STORM CLOUD FIRE DUST AIR',
 'Everyday':'HAND HEAD ARM HAIR FINGER TOOTH EYE EAR',
 'Travel':'OUT OVER BACK UP DOWN SIDE OFF CROSS',
 'Golden':'GOLD SILVER BLACK BLUE RED WHITE',
 'Rhythmic':'MUSIC TIME DAY BEAT WATCH',
 'Hidden':'KEY LOCK HOLE CHECK MARK PIN POINT',
 'Living':'LIFE GUARD REST WISH BONE HEART',
 'Pocket':'POCKET KNIFE PICK COIN GLASS PLATE NAME',
}
NOUNS='Signals Trails Connections Routes Detours Pathways Discoveries Footsteps Patterns Echoes Wonders Journeys Corners Crossings Moments Clues Turns Ways Adventures Horizons Stories Scenes Surprises Riddles Links Glimpses Ventures Threads Passages Encounters Puzzles Turns Tracks Notes Sparks Reflections Whispers Secrets Charms Motifs Designs Vistas Rhythms Currents Boundaries Landmarks Outlines Breaks Windows'.split()
for step in range(1000):
 # Deterministic sample keeps generation reproducible and avoids heavily used links.
 sample=candidates[:min(600,len(candidates))]
 c=min(sample,key=lambda c:sum((usage[w]+1)**2 for w in links(c)))
 candidates.remove(c)
 options=[w for w in words if w not in c and len(w)<=8]
 decoys=None
 for _ in range(250):
  d=rng.sample(options,3)
  if solutions(c,list(c[1:4])+d)==1:decoys=d;break
 if decoys is None:raise RuntimeError('Could not construct unique decoys')
 topics=[k for k,v in HINTS.items() if set(c)&set(v.split())]
 topics=topics or ['Everyday'];rng.shuffle(topics)
 title=None
 for topic,noun in itertools.product(topics,NOUNS[step%len(NOUNS):]+NOUNS[:step%len(NOUNS)]):
  if topic+' '+noun not in names:title=topic+' '+noun;break
 if title is None:
  # Three-word editorial fallback still uses a relevant semantic hint.
  for modifier,topic,noun in itertools.product(['Quiet','Bright','Winding','Unexpected','Little','Distant','Secret','Fresh','Open','Changing','Familiar','Curious'],topics,NOUNS):
   proposed=modifier+' '+topic+' '+noun
   if proposed not in names:title=proposed;break
 if title is None:raise RuntimeError('No distinct theme title')
 names.add(title)
 new.append({'id':'closed-v3-'+'-'.join(w.lower() for w in c),'name':title,'chain':list(c),'decoys':decoys})
 usage.update(links(c))
 if step%200==0:print('Added',step+1,flush=True)
# Keep every published date and today's puzzle exactly where it was.
start=datetime.date.fromisoformat(data['dailyLaunchDate']);freeze=(datetime.date(2026,10,30)-start).days+1
prefix=data['puzzles'][:freeze];remaining=data['puzzles'][freeze:]+new
scheduled=prefix[:];counts=collections.Counter(w for p in prefix for w in links(p['chain']))
last={w:i for i,p in enumerate(prefix) for w in links(p['chain'])}
for day in range(freeze,1800):
 def score(p):
  ls=links(p['chain']);gaps=[day-last.get(w,-10000) for w in ls]
  # Very strong preference for 7+ day separation, then 14+ days.
  repetition=sum(100000*(8-g)**2 if g<8 else 1000*(15-g)**2 if g<15 else 0 for g in gaps)
  same_theme=sum(len(set(p['name'].lower().split())&set(q['name'].lower().split())) for q in scheduled[-4:])
  overlap=sum(len(set(p['chain'])&set(q['chain'])) for q in scheduled[-2:])
  return repetition+same_theme*100+overlap*40+sum(counts[w] for w in ls)
 p=min(remaining,key=score);remaining.remove(p);scheduled.append(p)
 for w in links(p['chain']):last[w]=day;counts[w]+=1
assert len(scheduled)==1800 and len({tuple(p['chain']) for p in scheduled})==1800
assert scheduled[:freeze]==data['puzzles'][:freeze]
# Improve greedy tail ordering with deterministic local swaps. Published dates stay fixed.
sets=[set(links(p['chain'])) for p in scheduled]
weights={1:10000,2:8000,3:6000,4:4000,5:2500,6:1500,7:500}
def affected_cost(i,j):
 pairs=set()
 for pos in (i,j):
  for k in range(max(0,pos-7),min(len(sets),pos+8)):
   if k!=pos:pairs.add((min(k,pos),max(k,pos)))
 return sum(len(sets[a]&sets[b])*weights[b-a] for a,b in pairs)
for attempt in range(180000):
 i=rng.randrange(freeze,len(scheduled));j=rng.randrange(freeze,len(scheduled))
 if i==j:continue
 before=affected_cost(i,j)
 if before==0:continue
 sets[i],sets[j]=sets[j],sets[i]
 after=affected_cost(i,j)
 if after<=before:scheduled[i],scheduled[j]=scheduled[j],scheduled[i]
 else:sets[i],sets[j]=sets[j],sets[i]
# Expanded vocabulary must not turn old decoys into alternative correct answers.
# Preserve historical entries exactly; repair only unpublished future decoy banks.
for index,p in enumerate(scheduled):
 if solutions(p['chain'],p['chain'][1:4]+p['decoys'])!=1:
  assert index>=freeze, 'Historical puzzle would become ambiguous; revise the vocabulary.'
  c=p['chain'];options=[w for w in words if w not in c and len(w)<=8]
  for _ in range(1000):
   d=rng.sample(options,3)
   if solutions(c,c[1:4]+d)==1:
    p={**p,'decoys':d};scheduled[index]=p;break
  else:raise RuntimeError('An existing chain is intrinsically ambiguous')
assert len({p['id'] for p in scheduled})==1800
assert scheduled[:freeze]==data['puzzles'][:freeze]
data.update(contentVersion=8,description='1,800 daily puzzles. Published dates through 2026-10-30 preserved; future schedule balances compound recurrence.',approvedCompounds=sorted(approved),puzzles=scheduled)
Path(sys.argv[2]).write_text(json.dumps(data,indent=2)+'\n')
# Honest recurrence statistics; no promise of zero repeats across all 1,800 puzzles.
last={};gaps=[];near=[]
for i,p in enumerate(scheduled):
 for w in links(p['chain']):
  if w in last and i>=freeze:
   gap=i-last[w];gaps.append(gap)
   if gap<7:near.append((i,w,gap))
  last[w]=i
report={'totalPuzzles':1800,'addedPuzzles':1000,'approvedCompounds':len(approved),'preservedDatesThrough':'2026-10-30','allPuzzlesUniqueSolutions':all(solutions(p['chain'],p['chain'][1:4]+p['decoys'])==1 for p in scheduled),'futureCompoundRepeatsUnder7Days':len(near),'minimumFutureCompoundGapDays':min(gaps),'medianFutureCompoundGapDays':sorted(gaps)[len(gaps)//2],'firstNewTitles':[p['name'] for p in new[:12]]}
print(json.dumps(report,indent=2))
Path(sys.argv[2]).with_suffix('.quality.json').write_text(json.dumps(report,indent=2)+'\n')
