function $(str) {
    return document.querySelectorAll(str);
}

function el(str) {
    const split = str.split(".");
    const el = document.createElement(split[0] === '' ? "div" : split[0]);
    if(split.length > 1) split[1].split(",").forEach(class_name => el.classList.add(class_name))
    return el;
}