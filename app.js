var express = require('express');
var app = express();

var sassMiddleware = require('node-sass-middleware');
var path = require('path');
app.use(sassMiddleware({
    src: path.join(__dirname, 'sass'),
    dest: path.join(__dirname, 'public'),
    debug: true,
    outputStyle: 'compressed',
    prefix:  '/prefix'
}));

app.use(express.static('public'));

var uuid = require('uuid');

var server = require('http').Server(app);
server.listen(process.env.PORT || 3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
var io = require('socket.io')(server);

// GAME VARS

var monsters = {};
var monsterSpeed = 8;
var monsterTypes = ['toad', 'ghost'];

var mapWidth = 3072;
var mapHeight = 2048;
var wallWidth = 96;
var wallHeight = 60;

var Human = function(type, x, y, direction, id, speed, target) {
  this.type = type;
  this.x = x;
  this.y = y;
  this.direction = direction;
  this.id = id;
  this.target = target;
  this.speed = speed;
  this.steps = 0;
  this.stepsUntilChange = -1;
  this.stepDir = "";
};
var humans = {};
var humanSpeed = 9;
var humanIntervals = {};
var humanTypes = ['person_a', 'person_b', 'person_c'];

// END GAME VARS

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
  var id = uuid.v4();
  var monster = {
    id: id,
    x: 550,
    y: 450,
    // x: getRandomInt(wallWidth + 100, (mapWidth - wallWidth) - 100),
    // y: getRandomInt(wallHeight + 100, (mapHeight - wallHeight) - 100),
    type: monsterTypes[Math.floor(Math.random() * monsterTypes.length)],
    direction: 'up'
  }
  monsters[id] = monster;
  socket['monster_id'] = id;

  socket.emit('start', {monster: monster, info: {speed: monsterSpeed}});
  socket.broadcast.emit('player-connect', monster);

  socket.on('move', function (data) {
    if(data.id == undefined || data.x == undefined || data.y == undefined) {
      return;
    }
    var monster = monsters[data.id];
    if(monster.x + monsterSpeed == data.x || monster.x - monsterSpeed == data.x || monster.x == data.x) {
      if(monster.y + monsterSpeed == data.y || monster.y - monsterSpeed == data.y || monster.y == data.y) {
        if(data.x > wallWidth && data.x < mapWidth - wallWidth) {
          if(data.y > wallHeight && data.y < mapHeight - wallHeight) {
            monster.x = data.x;
            monster.y = data.y;
            monster.direction = data.direction;
            socket.broadcast.emit('update-pos', monster);
          }
        }
      }
    }
  });

  socket.on('attack', function(data) {
    //TODO check if we are hitting player
    socket.broadcast.emit('attacking', monsters[data.id]);
  })

  socket.on('disconnect', function() {
    socket.broadcast.emit('player-disconnect', socket.monster_id);
    delete monsters[socket.monster_id];
  });

});

function updatePerson(id) {
  var human = humans[id];
  var targetX = human.target.x;
  var targetY = human.target.y;
  var goDir = human.stepDir;

  var atX = targetX == human.x;
  var atY = targetY == human.y;
  if(human.steps >= human.stepsUntilChange || atX || atY) {
    human.steps = 0;
    human.stepsUntilChange = getRandomInt(50, 150);
    if(atX && atY) {
      buildHumanTarget(human);
      goDir = Math.random() > 0.5 ? "vert" : "hor";
    }
    else if(atX) {
      goDir = "vert";
    }
    else if(atY) {
      goDir = "hor";
    }
    else {
      goDir = Math.random() > 0.5 ? "vert" : "hor";
    }
    human.stepDir = goDir;
  }
  if(goDir == "vert") {
    if(targetY - human.y < 0) {
      human.direction = "up";
      human.y = Math.round(human.y - humanSpeed);
    }
    else if(targetY - human.y > 0){
      human.direction = "down";
      human.y = Math.round(human.y + humanSpeed);
    }
  }
  if(goDir == "hor") {
    if(targetX - human.x < 0) {
      human.direction = "left";
      human.x = Math.round(human.x -humanSpeed);
    }
    else if(targetX - human.x > 0){
      human.direction = "right";
      human.x = Math.round(human.x + humanSpeed);
    }
  }

  human.steps++;

  io.sockets.emit('human-pos', human);
}

function buildHuman(type) {
  var id = uuid.v4();
  var x = getRandomInt(wallWidth + 100, (mapWidth - wallWidth) - 100);
  var y = getRandomInt(wallHeight + 100, (mapHeight - wallHeight) - 100);
  var type = type != undefined ? type : humanTypes[Math.floor(Math.random() * humanTypes.length)]
  var newHuman = new Human(type, x, y, 'up', id, humanSpeed, buildHumanTarget());
  humans[id] = newHuman;
  updatePerson(id);
  var logicLoopId = setInterval(function() {
    updatePerson(id);
  }, .10 * 1000);
  humanIntervals[id] = id;
  humanIntervals[id].logic = logicLoopId;
  humanIntervals[id].reset = setInterval(function(){
    newHuman.target = buildHumanTarget();
    newHuman.steps = 0;
    newHuman.stepsUntilChange = getRandomInt(50, 150);
  }, 3 * 1000);
}

function buildHumanTarget() {
  var newTargetX = getRandomInt(wallWidth + 100, (mapWidth - wallWidth) - 100);
  var newTargetY = getRandomInt(wallHeight + 100, (mapHeight - wallHeight) - 100);
  return {x: newTargetX, y: newTargetY};
}

buildHuman('person_a');
buildHuman('person_b');
buildHuman('person_c');
for(var i = 0; i < 2; i++){
  buildHuman();
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
