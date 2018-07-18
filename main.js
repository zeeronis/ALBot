process.on('uncaughtException', function (exception) {
    console.log(exception);
    console.log(exception.stack);

});

const Discord = require("discord.js");
const client = new Discord.Client();
var child_process = require("child_process");
var HttpWrapper = require("./httpWrapper");
var httpWrapper = new HttpWrapper();
var fs = require("fs");
var userData = require("./userData.json");
var login = userData.login;
var bots = userData.bots;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

async function announce(text) {
    var guilds = client.guilds.array();
    for (let key in guilds) {
        var channels = guilds[key].channels.array();
        for (let key in channels) {
            if (channels[key].name == "game_events")
                channels[key].send(text);
        }
    }
}

async function main() {

    await client.login(userData.config.discordBotKey);
    httpWrapper = new HttpWrapper();
    var result = await httpWrapper.login(login.email, login.password);
    var characters = await httpWrapper.getCharacters();
    var userAuth = await httpWrapper.getUserAuth();

    if (userData.config.fetch) {
        console.log("Populating config file with data.");
        userData.bots = [];
        for (let i = 0; i < characters.length; i++) {
            console.log(characters[i]);
            userData.bots[i] = {
                characterName: characters[i].name,
                characterId: characters[i].id,
                runScript: "default.js",
                server: "EU I"
            }
        }
        userData.config.fetch = false;
        fs.writeFileSync("./userData.json", JSON.stringify(userData, null, 4));
        process.exit();
    }
    if (!result)
        throw new Error("Login failed");

    let serverList = await httpWrapper.getServerList();
    for (let i = 0; i < serverList.length; i++) {
        startPassiveGame([serverList[i].ip, serverList[i].port]);
    }
    //Checking for mistakes in userData.json
    if (!bots) {
        console.error("Missing field \"bots\" in userData.json");
    }

    for (let i = 0; i < bots.length; i++) {
        if (!(bots[i] && (bots[i].characterId || bots[i].characterName) && bots[i].runScript && bots[i].server))
            throw new Error("One or more necessary fields are missing from userData.json \n The following fields need to be present for a working executor:\n characterId or characterName\n runScript\n server\n");
    }

    //Reverse lookup name to characterId, names can't be used for starting a bot.
    for (let i = 0; i < bots.length; i++) {
        if (!bots[i].characterId) {
            for (let j = 0; j < characters.length; j++) {
                if (bots[i].characterName === characters[j].name) {
                    bots[i].characterId = characters[j].id;
                }
            }
        }
    }

    //Check that ids are unique, we don't want to start a bot twice.
    for (let i = 0; i < bots.length; i++) {
        if (bots[i])
            for (let j = i + 1; j < bots.length; j++) {
                if (bots[j])
                    if (bots[i].characterId === bots[j].characterId) {
                        console.error("Duplicate characterId " + bots[i].characterId + " ignoring second declaration.");
                        bots[j] = null;
                    }
            }
    }

    //Checks are done, starting bots.
    for (let i = 0; i < bots.length; i++) {
        let ip = "54.169.213.59";
        let port = 8090;
        for (let j = 0; j < serverList.length; j++) {
            let server = serverList[j];
            if (bots[i].server === server.region + " " + server.name) {
                ip = server.ip;
                port = server.port;
            }
        }
        var args = [httpWrapper.sessionCookie, httpWrapper.userAuth, httpWrapper.userId, ip, port, bots[i].characterId, bots[i].runScript, userData.config.botKey];
        startGame(args);
    }

}

function startGame(args) {
    let childProcess = child_process.fork("./game", args, {
        stdio: [0, 1, 2, 'ipc']
    });
    var data = {};

    childProcess.on('message', async (m) => {
        if (m.type === "status" && m.status === "disconnected") {
            childProcess.kill();
            startGame(args);
        } else if (m.type == "announce") {
            await announce(m.data);
        }
    });
}

function startPassiveGame(args) {
    let childProcess = child_process.fork("./passiveGame", args, {
        stdio: [0, 1, 2, 'ipc']
    });

    childProcess.on('message', async (m) => {
        if (m.type === "status" && m.status === "disconnected") {
            childProcess.kill();
            startPassiveGame(args);
        } else if (m.type == "announce") {
            await announce(m.data);
        }
    });
}

main();
