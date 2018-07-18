/**
 * Created by Nexus on 30.01.2018.
 */

var fs = require("fs");
eval(fs.readFileSync("./CODE/inventory.js") + '');

var jackpotPercentage = 0.75;
var numberPool = 11;
var poolSize = 6;
var jackPotTicket = [];
var ticketPrice = 20000;

function generateTicket() {
    var result = [];
    for (let i = 0; i < poolSize; i++) {
        result[i] = Math.floor(Math.random() * (numberPool + 1));
    }
    return result;
}


function announce(messaage) {
    process.send({
        type: "announce",
        data: messaage
    });
}

function roll(name) {
    var ticket = generateTicket();
    var numbersRight = 0;
    var temp1 = Array.from(jackPotTicket).sort();
    var temp2 = Array.from(ticket).sort();

    for (let i = 0; i < poolSize; i++) {
        if(temp1[i] === temp2[i]){
            numbersRight++;
        }
    }

    parent.socket.emit("say", {
        message: " The jackpot is " + "\n[" + jackPotTicket.join(",") + "]\n your ticket is \n[" + ticket.join(",") + "]\n, you got "+numbersRight+" "+((numbersRight===1)?"number":"numbers")+" right.",
        name: name,
        code: 0
    });
    let jackpot = Math.floor(character.gold * jackpotPercentage);
    switch (numbersRight){
        case 0: break;
        case 1: send_gold(name,ticketPrice*0.1); break;
        case 2: send_gold(name,ticketPrice); break;
        case 3: send_gold(name,ticketPrice*10); break;
        case 4: send_gold(name,ticketPrice*200); break;
        case 5: send_gold(name,ticketPrice*1000); break;
        case 6:
            announce("@everyone :moneybag: :money_mouth: :gem: "+name+" just cracked the jackpot and earned "+to_pretty_num(jackpot)+" gold. :moneybag: :money_mouth: :gem:");
            send_gold(name,jackpot);
        break;

    }
}

function listItem(tradeSlot, itemSlot, quantity, price) {
    parent.socket.emit("equip", {
        q: quantity,
        slot: "trade" + tradeSlot,
        num: itemSlot,
        value: price
    });
}

async function stockPotions() {

    var slots = character.slots;
    var potionSlot = inv.find("hpot0");
    if (!(potionSlot !== -1 && character.items[potionSlot] && character.items[potionSlot].q > 20)) {
        try {
            await inv.buyItem("hpot0", 200);
        } catch (e) {
            //TODO FIX THIS YOU MORON
            console.error(e);
            process.exit(1);
        }
    }

    for (let key in slots) {
        if (key.slice(0, 5) === "trade") {
            var index = key.slice(5);
            if (character.slots["trade" + index] === null)
                await inv.listItem(index, potionSlot, ticketPrice);
        }
    }

}

function announceJackpot() {
    let jackpot = Math.floor(character.gold * jackpotPercentage);
    parent.socket.emit("say", {message: "The current jackpot is at " + to_pretty_num(jackpot), code: 0});
}

async function main() {
    jackPotTicket = generateTicket();
    announceJackpot();
    setInterval(announceJackpot, 5 * 60 * 1000);

    setInterval(function () {
        stockPotions();
    }, 1000);

    var tradeSlot = inv.find("stand0");
    parent.socket.emit("merchant", {num: tradeSlot});
    parent.socket.emit('activate', {slot: 'ring1'});

    parent.socket.on("ui", function (data) {
        if (data.seller === character.id) {
            roll(data.buyer);
        }
    })
}

main();

