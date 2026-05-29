const API_KEY = "AIzaSyAM07AIfBXXRU0Y8MbpzySSVtCAG3xjHr0";
const DATABASE = "https://docs.google.com/spreadsheets/d//edit?gid=461762708#gid=461762708";
const spreadsheet_id = '1pSWHmoRA7jzdl81XBYCijammbIVrjFhTFQ6Q3Ema29s'; // Replace with your spreadsheet ID

async function fetch_data(named_range) {
    return new Promise((resolve) => {
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}/values/${named_range}?key=${API_KEY}`)
        .then(response => response.json())
        .then(data => {
            resolve(data.values)
        })
    })
}

function parse_table(json) {
    let trunc = json.filter(arr => (arr.filter(el => el === '').length === 0 && arr.length > 0))
    let parsed = [];
    trunc.forEach((arr, i) => {
        let obj = Object();
        arr.forEach((el, j) => {
            let formatted_el = el;
            const key = trunc[0][j];
            const bool_map = {"TRUE": true, "FALSE": false};
            if(Object.keys(bool_map).includes(el)) formatted_el = bool_map[el];
            if(key === "Date" && el !== key) {
                formatted_el = parse_gb_date(el);
            }
            if(key.includes("comma-separated")) formatted_el = el.split(",")
            obj[key] = formatted_el;
        })
        if(i > 0) parsed.push(obj)
    })
    return parsed;
}

function parse_document(json) {
    let trunc = json.slice(2, json.length);
    let parsed = [[]];
    let current = 0;

    trunc.forEach(el => {
        if (el.length === 0) {
            current++;
            parsed[current] = [];
        }
        else {
            parsed[current].push(String(el));
        }
    });

    let obj = parsed.map((el) => {
        return {"heading": el[0], "content": el.slice(1, el.length), "tag": el[0].toLowerCase().split(" ").join("_")}
    })

    return obj;
}

function parse_gb_date(str) {
    let split = str.split("/");
    let mm = split[1].length > 1 ? split[1] : `0${split[1]}`;
    let dd = split[0].length > 1 ? split[0] : `0${split[0]}`;
    let yyyy = split[2].length > 2 ? split[2] : `20${split[2]}`;
    return Date.parse([mm, dd, yyyy].join("/"));
}

fetch_data("events").then(data => {
    console.log(parse_table(data));
})

fetch_data("Contact").then(data => {
    console.log(parse_document(data))
})

