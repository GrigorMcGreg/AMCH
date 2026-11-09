/**
 * Логика сайта. Подключается обычным тегом script, без модулей и сборки.
 * Контакты читаются из js/config.js. Если файла нет, остаются тексты из HTML.
 */
(function () {
  "use strict";

  var config = window.SITE_CONFIG || {};
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.add("js");

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function scrollBehavior() {
    return reduceMotion ? "auto" : "smooth";
  }

  function bindText() {
    var nodes = document.querySelectorAll("[data-bind]");
    Array.prototype.forEach.call(nodes, function (node) {
      var key = node.getAttribute("data-bind");
      var value = clean(config[key]);
      if (value) node.textContent = value;
    });

    var yearNodes = document.querySelectorAll("[data-year]");
    var year = String(new Date().getFullYear());
    Array.prototype.forEach.call(yearNodes, function (node) {
      node.textContent = year;
    });

    var company = clean(config.companyName);
    if (company && company !== "Название компании") {
      document.title = document.title.split("Название компании").join(company);
    }
  }

  function phoneForLink() {
    var explicit = clean(config.phoneTel).replace(/[^\d+]/g, "");
    if (explicit.replace(/\D/g, "").length >= 10) return explicit;

    var display = clean(config.phoneDisplay);
    if (!display || display.indexOf("_") !== -1) return "";
    var digits = display.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return "";
    return display.replace(/[^\d+]/g, "");
  }

  function bindContacts() {
    var tel = phoneForLink();
    var email = clean(config.email);
    var emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    Array.prototype.forEach.call(document.querySelectorAll("[data-contact='phone']"), function (link) {
      if (!tel) return;
      link.setAttribute("href", "tel:" + tel);
      link.setAttribute("aria-label", "Позвонить, " + (clean(config.phoneDisplay) || tel));
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-contact='email']"), function (link) {
      if (!emailReady) return;
      link.setAttribute("href", "mailto:" + email);
      link.setAttribute("aria-label", "Написать на " + email);
      if (link.hasAttribute("data-email-text")) link.textContent = email;
    });

    var mapUrl = clean(config.mapUrl);
    var mapLink = document.querySelector("[data-map-link]");
    var mapNote = document.querySelector("[data-map-note]");
    if (mapLink && /^https:\/\/\S+$/i.test(mapUrl)) {
      mapLink.href = mapUrl;
      mapLink.hidden = false;
      mapLink.rel = "noopener noreferrer";
      mapLink.target = "_blank";
      if (mapNote) mapNote.hidden = true;
    }
  }

  function headerOffset() {
    var header = document.querySelector(".header");
    return header ? header.offsetHeight + 8 : 0;
  }

  function closeMenu() {
    var box = document.getElementById("nav-check");
    if (box) box.checked = false;
  }

  function bindMenu() {
    var box = document.getElementById("nav-check");
    var label = document.querySelector(".nav-toggle");
    if (!box || !label) return;

    function sync() {
      var open = box.checked;
      label.setAttribute("aria-expanded", open ? "true" : "false");
    }

    box.addEventListener("change", sync);
    sync();

    Array.prototype.forEach.call(document.querySelectorAll(".nav a"), function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  function bindSmoothScroll() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest("a[href^='#']");
      if (!link) return;
      var hash = link.getAttribute("href");
      if (!hash || hash === "#") return;
      var target = document.getElementById(hash.slice(1));
      if (!target) return;
      event.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset();
      window.scrollTo({ top: top, behavior: scrollBehavior() });
      if (history.pushState) history.pushState(null, "", hash);
      closeMenu();
    });
  }

  function bindHeaderState() {
    var header = document.querySelector(".header");
    var toTop = document.querySelector(".to-top");
    if (!header && !toTop) return;

    function update() {
      var scrolled = window.pageYOffset > 8;
      if (header) header.classList.toggle("is-stuck", scrolled);
      if (toTop) toTop.hidden = window.pageYOffset < 560;
    }

    update();
    window.addEventListener("scroll", update, { passive: true });

    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
      });
    }
  }

  function bindReveal() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, function (node) {
        node.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

    Array.prototype.forEach.call(nodes, function (node) {
      observer.observe(node);
    });
  }

  function bindServiceRows() {
    var rows = document.querySelectorAll(".service-row");
    if (rows.length < 2) return;

    Array.prototype.forEach.call(rows, function (row) {
      row.addEventListener("toggle", function () {
        if (!row.open) return;
        Array.prototype.forEach.call(rows, function (other) {
          if (other !== row) other.open = false;
        });
      });
    });
  }

  function bindLightbox() {
    var dialog = document.getElementById("lightbox");
    if (!dialog) return;

    var image = dialog.querySelector(".lightbox__image");
    var caption = dialog.querySelector(".lightbox__caption");
    var triggers = [];
    var current = 0;
    var lastFocus = null;

    function visibleTriggers() {
      return Array.prototype.filter.call(document.querySelectorAll("[data-lightbox]"), function (link) {
        var card = link.closest(".work");
        if (!card) return true;
        return window.getComputedStyle(card).display !== "none";
      });
    }

    function show(index) {
      triggers = visibleTriggers();
      if (!triggers.length) return;
      current = (index + triggers.length) % triggers.length;
      var link = triggers[current];
      var picture = link.querySelector("img");
      image.src = link.getAttribute("href");
      image.alt = picture ? picture.alt : "";
      caption.textContent = link.getAttribute("data-caption") || (picture ? picture.alt : "");
    }

    function open(link) {
      lastFocus = link;
      triggers = visibleTriggers();
      var index = triggers.indexOf(link);
      dialog.hidden = false;
      document.body.classList.add("is-locked");
      show(index < 0 ? 0 : index);
      var closeButton = dialog.querySelector("[data-lightbox-close]");
      if (closeButton) closeButton.focus();
    }

    function close() {
      dialog.hidden = true;
      image.removeAttribute("src");
      document.body.classList.remove("is-locked");
      if (lastFocus) lastFocus.focus();
    }

    document.addEventListener("click", function (event) {
      var link = event.target.closest("[data-lightbox]");
      if (!link) return;
      event.preventDefault();
      open(link);
    });

    dialog.addEventListener("click", function (event) {
      if (event.target.closest("[data-lightbox-close], .lightbox__backdrop")) close();
      if (event.target.closest("[data-lightbox-prev]")) show(current - 1);
      if (event.target.closest("[data-lightbox-next]")) show(current + 1);
    });

    document.addEventListener("keydown", function (event) {
      if (dialog.hidden) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") show(current - 1);
      if (event.key === "ArrowRight") show(current + 1);
      if (event.key !== "Tab") return;

      var focusable = dialog.querySelectorAll("button");
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function bindPortfolio() {
    var board = document.querySelector(".portfolio-board");
    if (!board) return;

    var inputs = board.querySelectorAll(".filter-input");
    var empty = board.querySelector(".filter-empty");
    var count = board.querySelector(".filter-count");

    function selected() {
      var checked = board.querySelector(".filter-input:checked");
      return checked ? checked.value : "all";
    }

    function update() {
      var category = selected();
      var visible = 0;
      Array.prototype.forEach.call(board.querySelectorAll(".work"), function (card) {
        var match = category === "all" || card.getAttribute("data-category") === category;
        if (match) visible += 1;
      });
      if (empty) empty.hidden = visible !== 0;
      if (count) {
        count.textContent = visible === 0
          ? "В этой категории пока нет работ."
          : "На экране работ: " + visible + ".";
      }
    }

    function applyHash() {
      var hash = window.location.hash.replace("#", "");
      if (!hash) return;
      Array.prototype.forEach.call(inputs, function (input) {
        if (input.value === hash) input.checked = true;
      });
    }

    applyHash();
    update();

    Array.prototype.forEach.call(inputs, function (input) {
      input.addEventListener("change", function () {
        if (history.replaceState) {
          history.replaceState(null, "", input.value === "all" ? "portfolio.html" : "#" + input.value);
        }
        update();
      });
    });

    window.addEventListener("hashchange", function () {
      applyHash();
      update();
    });
  }

  var fileLimit = 4;
  var fileSizeLimit = 10 * 1024 * 1024;
  var fileTypes = ["jpg", "jpeg", "png", "webp", "gif", "pdf", "dwg", "dxf"];
  var filesOf = new WeakMap();

  function fileStore(form) {
    var store = filesOf.get(form);
    if (!store) {
      store = new DataTransfer();
      filesOf.set(form, store);
    }
    return store;
  }

  function extensionOf(name) {
    var parts = String(name).toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function renderFiles(form) {
    var list = form.querySelector(".file-list");
    var input = form.querySelector("input[type='file']");
    if (!list || !input) return;
    var store = fileStore(form);
    input.files = store.files;
    list.textContent = "";

    Array.prototype.forEach.call(store.files, function (file, index) {
      var item = document.createElement("li");
      var name = document.createElement("span");
      var sizeKb = Math.max(1, Math.round(file.size / 1024));
      name.textContent = file.name + " — " + sizeKb + " КБ";
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "file-list__remove";
      remove.textContent = "Убрать";
      remove.addEventListener("click", function () {
        var next = new DataTransfer();
        Array.prototype.forEach.call(store.files, function (current, currentIndex) {
          if (currentIndex !== index) next.items.add(current);
        });
        filesOf.set(form, next);
        renderFiles(form);
      });
      item.appendChild(name);
      item.appendChild(remove);
      list.appendChild(item);
    });
  }

  function addFiles(form, incoming) {
    var store = fileStore(form);
    var message = "";

    Array.prototype.forEach.call(incoming, function (file) {
      if (message) return;
      if (store.files.length >= fileLimit) {
        message = "Можно прикрепить не больше " + fileLimit + " файлов.";
        return;
      }
      if (file.size > fileSizeLimit) {
        message = "Файл «" + file.name + "» больше 10 МБ.";
        return;
      }
      var ext = extensionOf(file.name);
      if (fileTypes.indexOf(ext) === -1) {
        message = "Формат файла «" + file.name + "» не поддерживается.";
        return;
      }
      store.items.add(file);
    });

    renderFiles(form);
    return message;
  }

  function fieldError(field, text) {
    var box = field.closest(".field");
    var slot = box ? box.querySelector(".field__error") : null;
    if (box) box.classList.toggle("is-invalid", Boolean(text));
    field.setAttribute("aria-invalid", text ? "true" : "false");
    if (!slot) return;
    slot.hidden = !text;
    slot.textContent = text || "";
    if (text) {
      if (!slot.id) slot.id = field.id + "-error";
      field.setAttribute("aria-describedby", slot.id);
    } else {
      field.removeAttribute("aria-describedby");
    }
  }

  function validateForm(form) {
    var firstInvalid = null;

    function check(name, test, message) {
      var field = form.elements[name];
      if (!field) return;
      var value = clean(field.value);
      var error = test(value);
      fieldError(field, error ? message : "");
      if (error && !firstInvalid) firstInvalid = field;
    }

    check("name", function (value) {
      return value.length < 2 || value.length > 80;
    }, "Укажите имя: от 2 до 80 символов.");

    check("phone", function (value) {
      var digits = value.replace(/\D/g, "");
      return digits.length < 10 || digits.length > 15;
    }, "Укажите телефон: от 10 до 15 цифр.");

    check("email", function (value) {
      return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }, "Укажите электронную почту в формате name@domain.ru.");

    check("direction", function (value) {
      return value.length === 0;
    }, "Выберите направление работ.");

    check("message", function (value) {
      return value.length < 10 || value.length > 4000;
    }, "Опишите задачу: от 10 до 4000 символов.");

    var fileMessage = "";
    var fileInput = form.querySelector("input[type='file']");
    if (fileInput && fileInput.files.length > fileLimit) {
      fileMessage = "Слишком много файлов.";
    }
    var fileSlot = form.querySelector(".file-error");
    if (fileSlot) {
      fileSlot.hidden = !fileMessage;
      fileSlot.textContent = fileMessage;
    }
    if (fileMessage && !firstInvalid) firstInvalid = fileInput;

    return firstInvalid;
  }

  function setStatus(form, kind, text) {
    var status = form.querySelector(".form-status");
    if (!status) return;
    status.hidden = !text;
    status.className = "form-status" + (kind ? " is-" + kind : "");
    status.textContent = text || "";
  }

  function endpointReady(value) {
    if (!value) return false;
    if (/^https?:\/\/\S+$/i.test(value)) return true;
    return /^(\.\.\/|\.\/|\/)?[\w\-./]+\.php(?:\?[\w\-./=&%]*)?$/.test(value);
  }

  function bindForms() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-request-form]"), function (form) {
      var drop = form.querySelector(".dropzone");
      var input = form.querySelector("input[type='file']");

      if (input) {
        input.addEventListener("change", function () {
          var message = addFiles(form, input.files);
          var fileSlot = form.querySelector(".file-error");
          if (fileSlot) {
            fileSlot.hidden = !message;
            fileSlot.textContent = message || "";
          }
        });
      }

      if (drop && input) {
        ["dragenter", "dragover"].forEach(function (name) {
          drop.addEventListener(name, function (event) {
            event.preventDefault();
            drop.classList.add("is-drag");
          });
        });
        ["dragleave", "drop"].forEach(function (name) {
          drop.addEventListener(name, function (event) {
            event.preventDefault();
            drop.classList.remove("is-drag");
          });
        });
        drop.addEventListener("drop", function (event) {
          var files = event.dataTransfer ? event.dataTransfer.files : null;
          if (!files || !files.length) return;
          var message = addFiles(form, files);
          var fileSlot = form.querySelector(".file-error");
          if (fileSlot) {
            fileSlot.hidden = !message;
            fileSlot.textContent = message || "";
          }
        });
      }

      form.addEventListener("input", function () {
        setStatus(form, "", "");
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var invalid = validateForm(form);
        if (invalid) {
          setStatus(form, "error", "Заявка не отправлена: проверьте выделенные поля.");
          invalid.focus();
          return;
        }

        var honeypot = form.elements.website;
        if (honeypot && clean(honeypot.value)) {
          setStatus(form, "error", "Заявка не отправлена.");
          return;
        }

        var endpoint = clean(config.formEndpoint);
        var email = clean(config.email);
        var emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        var attached = input && input.files && input.files.length > 0;
        var submit = form.querySelector("[type='submit']");

        if (endpointReady(endpoint)) {
          if (submit) submit.disabled = true;
          setStatus(form, "wait", "Отправляем заявку обработчику…");
          fetch(endpoint, {
            method: "POST",
            body: new FormData(form),
            headers: { Accept: "application/json" }
          }).then(function (response) {
            return response.json().catch(function () {
              return { ok: false, error: "Ответ обработчика не распознан." };
            }).then(function (data) {
              return { okHttp: response.ok, data: data || {} };
            });
          }).then(function (result) {
            if (result.okHttp && result.data && result.data.ok === true) {
              form.reset();
              filesOf.set(form, new DataTransfer());
              renderFiles(form);
              setStatus(form, "ok", "Обработчик принял заявку.");
              return;
            }
            var reason = result.data && result.data.error
              ? result.data.error
              : "Сервер не подтвердил приём.";
            setStatus(form, "error", "Заявка не отправлена. " + reason);
          }).catch(function () {
            setStatus(form, "error", "Связаться с обработчиком не удалось. Заявка не отправлена. Если страница открыта как файл с диска, нужен хостинг, где обработчик действительно запускается.");
          }).then(function () {
            if (submit) submit.disabled = false;
          });
          return;
        }

        if (attached) {
          setStatus(form, "error", "Заявка не отправлена. Чертёж или фотографию можно передать только через серверный обработчик: укажите formEndpoint в js/config.js. Почтовая программа не забирает файлы с сайта.");
          return;
        }

        if (emailReady) {
          var body = [
            "Имя: " + clean(form.elements.name.value),
            "Телефон: " + clean(form.elements.phone.value),
            "Почта: " + clean(form.elements.email.value),
            "Направление: " + clean(form.elements.direction.value),
            "",
            clean(form.elements.message.value)
          ].join("\n");
          var mailto = "mailto:" + email + "?subject=" + encodeURIComponent("Заявка с сайта") + "&body=" + encodeURIComponent(body);
          if (mailto.length > 1800) {
            setStatus(form, "error", "Заявка не отправлена: текст слишком длинный для почтовой программы. Подключите formEndpoint в js/config.js.");
            return;
          }
          window.location.href = mailto;
          setStatus(form, "warn", "Автоматическая отправка не настроена. Открыта почтовая программа — письмо уйдёт только после того, как вы сами нажмёте «Отправить». Сайт заявку не отправлял.");
          return;
        }

        setStatus(form, "error", "Заявка не отправлена: в js/config.js не указаны адрес обработчика и электронная почта. Данные остались в форме.");
      });
    });
  }

  function bindPrint() {
    var button = document.getElementById("print-brochure");
    if (!button) return;
    button.addEventListener("click", function () {
      window.print();
    });
  }

  bindText();
  bindContacts();
  bindMenu();
  bindSmoothScroll();
  bindHeaderState();
  bindReveal();
  bindServiceRows();
  bindLightbox();
  bindPortfolio();
  bindForms();
  bindPrint();
})();
