/**
 * Created by nexus on 03/04/17.
 */


var LocalStorage = require('node-localstorage').LocalStorage;
var HttpWrapper = require("./httpWrapper");
localStorage = new LocalStorage('./localStorage');

function close(error) {
    console.error(error);
    process.exit(1);
}


var Game = function (ip, port, characterId, script, botKey, G, httpWrapper) {
    this.ip = ip;
    this.port = port;
    this.userId = httpWrapper.userId;
    this.characterId = characterId;
    this.socketAuth = httpWrapper.userAuth;
    this.httpWrapper = httpWrapper;
    this.script = script;
    this.botKey = botKey;
    this.excutor = null;
    this.interface = null;
    this.events = {};
    this.socket = null;
    this.executor = null;
    this.G = G

}

Game.prototype.init = function () {
    let self = this;
    var fs = require("fs");
    var G = this.G;

    var character_to_load;
    var first_entities = false;
    var inside = "selection";
    var user_id, user_auth;
    var server_names = {"US": "Americas", "EU": "Europas", "ASIA": "Eastlands"};
    var perfect_pixels = '';
    var cached_map = '1', scale = '2';
    var d_lines = '1';
    var sd_lines = '1';
    var c_enabled = '1', stripe_enabled = '';
    var auto_reload = "auto", reload_times = '0', code_to_load = null, mstand_to_load = null;
    var EPS = 1e-16;

    var first_coords = false,
        first_x = 0,
        first_y = 0;

    var code_active = false;
    var current_map = "";
    var pull_all_next = false;
    var pull_all = false;
    var heartbeat = new Date();
    var slow_heartbeats = 0;
    var game_loaded = false;
    var prepull_target_id = null;
    var is_pvp = false;
    var server_region = "";
    var server_identifier = "";
    var server_name = "";
    var socket;
    var server_addr, port;
    var last_draw = new Date();
    var M;
    var entities = {}
    var future_entities = {
        players: {},
        monsters: {}
    };
    var character;

    var game = null;

    var httpWrapper = this.httpWrapper;

    game = this;
    server_addr = this.ip;
    port = this.port;

    eval(fs.readFileSync('modedGameFiles/game.js') + '');

    init_socket();
    this.socket = socket;
    socket.on("game_chat_log", function (data) {
        console.log("game_chat_log",data)

    });
    socket.on("server_message", function (data) {
        var info = /([a-zA-Z0-9]+) (?:received|lost|found) (?:(?:a|an) |)([a-zA-Z ']+)\+*([0-9])*/g.exec(data.message);
        if(info && info[1] && info[2]){
            let characterName = info[1];
            let itemName = info[2].trim();
            let level = info[3];
            let itemId = "";
            for(var key in G.items){
                if(itemName === G.items[key].name){
                    itemId = key;
                }
            }
            if(itemId){
                let price = calculate_item_value({name:itemId, level:level});
                if(price > 200000)
                    process.send({
                        type:"announce",
                        data: "["+server_region+" "+server_identifier+"] "+data.message
                    });
            } else {
                console.error("Can not find itemName in:"+data.message);
            }
        } else
            console.error("Can not find properties in:"+data.message);



    });
    socket.on("game_event", function (data) {
        if (!data.name) {
            data = {name: data}
        }
        if (data.name == "pinkgoo") {
            process.send({
                type:"announce",
                data: "["+server_region+" "+server_identifier+"]"+"The 'Love Goo' has respawned in " + G.maps[data.map].name + "!"
            });
        }
        if (data.name == "wabbit") {
            process.send({
                type:"announce",
                data: "["+server_region+" "+server_identifier+"]"+"Wabbit has respawned in " + G.maps[data.map].name + "!"
            });
        }
        if (data.name == "goldenbat") {
            process.send({
                type:"announce",
                data: "["+server_region+" "+server_identifier+"]"+"The Golden Bat has spawned in " + G.maps[data.map].name + "!"
            });
        }
    });
    socket.on("disconnect",function(){
        self.emit("disconnected","nothing");
        process.send({type:"status", status:"disconnected"});
        self.stop();
    });
    socket.on("game_error", function (data) {
        if ("Failed: ingame" == data) {
            setTimeout(function () {
                console.log("Retrying for " + character_to_load);
                log_in(user_id, character_to_load, user_auth);
            }, 30 * 1000);
        } else if (/Failed: wait_(\d+)_seconds/g.exec(data) != null) {
            let time = /Failed: wait_(\d+)_seconds/g.exec(data)[1];
            setTimeout(function () {
                console.log("Retrying for " + character_to_load);
                log_in(user_id, character_to_load, user_auth);
            }, time * 1000 + 1000);
        }
    });
}
/**
 * Register's an event in the game
 * @param event string the name f the event
 * @param callback function the function to be called
 */
Game.prototype.on = function (event, callback) {
    if (typeof event == "string" && typeof callback == "function") {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    } else {
        if (typeof event != "string")
            throw new Error("Event has to be a string")
        if (typeof callback == "function")
            throw new Error("Callback has to be a function")
    }
};

Game.prototype.emit = function (event, arguments) {
    if (typeof event == "string") {
        if (this.events[event]) {
            this.events[event].forEach(function (current) {
                current.apply(Array.from(arguments).slice(1))
            });
        }
    }
}

Game.prototype.stop = function () {
    if (this.socket)
        this.socket.close();
}

async function main() {
    let args = process.argv.slice(2);
    let httpWrapper = new HttpWrapper(args[0], args[1], args[2]);
    let gameData = await httpWrapper.getGameData();
    let game = new Game(args[3], args[4], args[5], args[6], args[7], gameData, httpWrapper);
    game.init();
}

