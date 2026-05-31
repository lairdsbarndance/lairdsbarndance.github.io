function $(str) {
    return document.querySelectorAll(str);
}

function $el(str) {
    const split = str.split(".");
    const dom_el = document.createElement(split[0] === '' ? "div" : split[0]);
    if(split.length > 1) split[1].split(",").forEach(class_name => dom_el.classList.add(class_name))
    return dom_el;
}

Element.prototype.appendChildren = function (...children) {
    children.forEach(child => {
        this.appendChild(child);
    });
    return this;
};