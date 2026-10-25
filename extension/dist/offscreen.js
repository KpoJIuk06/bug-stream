"use strict";
(() => {
  // src/core/db.ts
  var DB = "bugstream";
  var dbPromise = null;
  function setDatabaseName(name) {
    DB = name;
    dbPromise = null;
  }
  var RECORDINGS = "recordings";
  var CHUNKS = "chunks";
  var EVENTS = "events";
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore(RECORDINGS, { keyPath: "id" });
        db.createObjectStore(CHUNKS, { keyPath: ["rid", "seq"] });
        db.createObjectStore(EVENTS, { keyPath: ["rid", "seq"] });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => dbPromise = null;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
    return dbPromise;
  }
  async function run(stores, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t2 = db.transaction(stores, mode);
      const req = fn(t2);
      t2.oncomplete = () => resolve(req ? req.result : void 0);
      t2.onerror = () => reject(t2.error);
      t2.onabort = () => reject(t2.error ?? new Error("IndexedDB: transaction aborted"));
    });
  }
  var range = (rid) => IDBKeyRange.bound([rid, 0], [rid, Number.MAX_SAFE_INTEGER]);
  var putRecording = (r) => run(RECORDINGS, "readwrite", (t2) => void t2.objectStore(RECORDINGS).put(r));
  var deleteRecording = (id) => run([RECORDINGS, CHUNKS, EVENTS], "readwrite", (t2) => {
    t2.objectStore(RECORDINGS).delete(id);
    t2.objectStore(CHUNKS).delete(range(id));
    t2.objectStore(EVENTS).delete(range(id));
  });
  var putChunk = (rid, seq, data, ts) => run(CHUNKS, "readwrite", (t2) => void t2.objectStore(CHUNKS).put({ rid, seq, data, ts }));
  var putEventBatch = (rid, seq, events) => run(EVENTS, "readwrite", (t2) => void t2.objectStore(EVENTS).put({ rid, seq, events }));
  async function getEventBatches(rid) {
    const rows = await run(EVENTS, "readonly", (t2) => t2.objectStore(EVENTS).getAll(range(rid)));
    return rows.sort((a, b) => a.seq - b.seq).flatMap((r) => r.events);
  }
  var clearEventBatches = (rid) => run(EVENTS, "readwrite", (t2) => void t2.objectStore(EVENTS).delete(range(rid)));
  function videoTime(ts, startTs, pauses) {
    let paused = 0;
    for (const [a, b] of pauses) {
      if (ts <= a) break;
      paused += Math.min(ts, b) - a;
    }
    return Math.max(0, ts - startTs - paused);
  }
  function finishRecording(r, events, stopTs) {
    const pauses = r.pauses.map(([a, b]) => [a, Math.min(b, stopTs)]);
    const durationMs = videoTime(stopTs, r.startTs, pauses);
    return {
      ...r,
      status: "done",
      pauses,
      durationMs,
      events: events.filter((e) => e.ts <= stopTs).map((e) => ({ ...e, t: Math.min(durationMs, videoTime(e.ts, r.startTs, pauses)) })).sort((a, b) => a.t - b.t || a.ts - b.ts)
    };
  }

  // src/shared/db.ts
  setDatabaseName("adtask");

  // src/shared/i18n-dict.ts
  var enPlurals = {
    "{n} console errors": ["{n} console error", "{n} console errors"],
    "{n} network errors": ["{n} network error", "{n} network errors"],
    "{n} requests": ["{n} request", "{n} requests"],
    "{n} actions": ["{n} action", "{n} actions"]
  };
  var ru = {
    "This site is not linked to a Bug Stream project": "Этот сайт не привязан к проекту Bug Stream",
    "Recording is already running": "Запись уже идёт",
    "This page cannot be recorded — open a site (http or https).": "Эту страницу записать нельзя — откройте сайт (http или https).",
    "Could not start recording": "Не удалось начать запись",
    "This page cannot be captured — open a site (http or https).": "Эту страницу снять нельзя — откройте сайт (http или https).",
    "Instant replay does not work on this page.": "На этой странице instant replay не работает.",
    "Instant replay is off — turn it on in the extension settings.": "Instant replay выключен — включите его в настройках расширения.",
    "There is no recording for this page yet. Instant replay starts when the page loads — reload it and try again later.": "Для этой страницы ещё нет записи. Instant replay начинает запись при загрузке страницы — обновите её и повторите позже.",
    "Could not write the video to disk: {error}": "Не удалось записать видео на диск: {error}",
    "The video was not recorded": "Видео не записалось",
    "Recording cancelled — no tab was selected": "Запись отменена — вкладка не выбрана",
    "Paused — no activity": "Пауза — нет действий",
    "Paused — tab hidden": "Пауза — вкладка скрыта",
    "Paused": "Пауза",
    "Recording": "Идёт запись",
    "Resume": "Продолжить",
    "Pause": "Пауза",
    "This page cannot be recorded. Open the site where you found the bug.": "На этой странице записывать нельзя. Откройте сайт, на котором нашли ошибку.",
    "Video": "Видео",
    "Screenshot": "Скриншот",
    "Open": "Открыть",
    "Starting…": "Запускаем…",
    "Record tab": "Записать вкладку",
    "This recording is still running. Stop it and the report will open by itself.": "Эта запись ещё идёт. Остановите её — отчёт откроется сам.",
    "New report": "Новый отчёт",
    "Instant replay — last 2 minutes": "Instant replay — последние 2 минуты",
    "Could not open the page recording": "Не удалось открыть запись страницы",
    "Page screenshot": "Скриншот страницы",
    "No video": "Нет видео",
    "{n} console errors": ["{n} ошибка в консоли", "{n} ошибки в консоли", "{n} ошибок в консоли"],
    "{n} network errors": ["{n} ошибка сети", "{n} ошибки сети", "{n} ошибок сети"],
    "{n} requests": ["{n} запрос", "{n} запроса", "{n} запросов"],
    "{n} actions": ["{n} действие", "{n} действия", "{n} действий"],
    "No events": "Событий нет",
    "What went wrong": "Что пошло не так",
    "Nothing found": "Ничего не найдено",
    "No project": "Без проекта",
    "Detected from the page address: {project} / {service}": "Определено по адресу страницы: {project} / {service}",
    "Create an issue in Jira ({key})": "Создать задачу в Jira ({key})",
    "Your Jira token has expired or was revoked.": "Ваш токен Jira истёк или отозван.",
    "Add your Jira API token to create issues.": "Добавьте свой API-токен Jira, чтобы создавать задачи.",
    "Open profile": "Открыть профиль",
    "Not selected": "Не выбран",
    "Saving…": "Сохраняем…",
    "Your session has expired — sign in to the extension again": "Сессия истекла — войдите в расширение заново",
    "The server rejected the report: {detail}": "Сервер не принял отчёт: {detail}",
    "Creating the Jira issue…": "Создаём задачу в Jira…",
    "Jira issue created:": "Задача в Jira создана:",
    "Then send the report to Jira from its page.": "Затем отправьте отчёт в Jira с его страницы.",
    "The Jira issue was not created: {error}. You can send it from the report page.": "Задача в Jira не создана: {error}. Отправить можно со страницы отчёта.",
    "Link copied": "Ссылка скопирована",
    "The server is unreachable. The recording stays in the extension — try again.": "Сервер недоступен. Запись осталась в расширении — попробуйте ещё раз.",
    "Save report": "Сохранить отчёт",
    "Delete the recording without saving?": "Удалить запись без сохранения?",
    "Wrong login or password": "Неверный логин или пароль",
    "Your account is disabled — contact an administrator": "Учётная запись отключена — обратитесь к администратору",
    "You are not in a group that has access to Bug Stream": "Вы не состоите в группе с доступом к Bug Stream",
    "The corporate directory is not available, try again later": "Корпоративный каталог недоступен, попробуйте позже",
    "The code is wrong or has expired — request a new one": "Код неверный или устарел — запросите новый",
    "This sign-in method is turned off": "Этот способ входа выключен",
    "Too many attempts — wait a few minutes and try again": "Слишком много попыток — подождите несколько минут",
    "Enter a valid e-mail address": "Введите корректный e-mail",
    "Your session has expired — sign in again": "Сессия истекла — войдите заново",
    "Server error. Try again.": "Ошибка сервера. Попробуйте ещё раз.",
    "The server is unreachable. Check the address and that you are in the corporate network.": "Сервер недоступен. Проверьте адрес и что вы в корпоративной сети.",
    "Server address": "Адрес сервера",
    "Address of the Bug Stream site in your network": "Адрес сайта Bug Stream в вашей сети",
    "Password": "Пароль",
    "E-mail code": "Код на почту",
    "E-mail": "E-mail",
    "We will send a one-time code — no password needed.": "Пришлём одноразовый код — пароль не нужен.",
    "Code from the e-mail": "Код из письма",
    "Another e-mail": "Другой e-mail",
    "Send again": "Отправить ещё раз",
    "Work login or e-mail": "Рабочий логин или e-mail",
    "If {email} can sign in, a 6-digit code is on its way. It is valid for 10 minutes.": "Если {email} может входить, код из 6 цифр уже в пути. Он действует 10 минут.",
    "Send code": "Отправить код",
    "Sign in": "Войти",
    "Sending…": "Отправляем…",
    "Signing in…": "Входим…",
    "Bug Stream recording": "Запись Bug Stream",
    "Pause (no video is written, the timer stops)": "Пауза (видео не пишется, время не идёт)",
    "Stop recording and open the report": "Остановить запись и открыть отчёт",
    "Stop": "Стоп",
    "Stop without saving": "Остановить без сохранения",
    "Cancel": "Отмена",
    "Stop recording without saving?": "Остановить запись без сохранения?",
    "Report a bug": "Сообщить об ошибке",
    "Stop recording": "Остановить запись",
    "and open the report": "и открыть отчёт",
    "Record video": "Записать видео",
    "Chrome will ask which tab to record — choose this one and press “Share”": "Chrome спросит, какую вкладку записывать — выберите эту и нажмите «Поделиться»",
    "with console and network of the last minutes": "с консолью и сетью за последние минуты",
    "Last 2 minutes": "Последние 2 минуты",
    "what happened on the page up to now": "что происходило на странице до этого момента",
    "turn on instant replay in the extension settings": "включите instant replay в настройках расширения",
    "The Bug Stream extension is unavailable — reload the page": "Расширение Bug Stream недоступно — обновите страницу",
    "Console": "Консоль",
    "Network": "Сеть",
    "Action": "Действие",
    "Navigation": "Переход",
    "Log": "Лог",
    "Paused — no activity. Resumes when you come back": "Пауза — нет действий. Продолжится, когда вы вернётесь",
    "Open site": "Открыть сайт",
    "Instant replay: save what happened on the page during the last 2 minutes": "Instant replay: сохранить то, что происходило на странице последние 2 минуты",
    "Last 2 min": "Последние 2 мин",
    "Stop and open the report": "Остановить и открыть отчёт",
    "Unsaved recordings": "Несохранённые записи",
    "Recording settings": "Настройки записи",
    "Maximum video length": "Максимальная длина видео",
    "5 minutes": "5 минут",
    "10 minutes": "10 минут",
    "20 minutes": "20 минут",
    "30 minutes": "30 минут",
    "The video is written to the computer's disk, not to memory. 10 minutes ≈ 110 MB.": "Видео пишется на диск компьютера, а не в память. 10 минут ≈ 110 МБ.",
    "Pause when nothing happens": "Пауза, если ничего не происходит",
    "No mouse movement or key presses for": "Нет движений мыши и нажатий",
    "30 s": "30 с",
    "1 min": "1 мин",
    "2 min": "2 мин",
    "5 min": "5 мин",
    "or the tab is hidden — recording pauses and resumes by itself when you come back.": "или вкладка скрыта — запись встаёт на паузу и продолжается сама, когда вы вернётесь.",
    "Instant replay on this site": "Instant replay на этом сайте",
    "Language": "Язык",
    "Sign out": "Выйти",
    "The extension keeps a recording of the last 2 minutes of the page in memory (no video — page snapshots). Nothing is sent until you press “Last 2 min” or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd>.": "Расширение всё время держит в памяти запись страницы за последние 2 минуты (без видео — снимки страницы). Ничего не отправляется, пока вы не нажмёте «Последние 2 мин» или <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd>.",
    "The recording captures the tab video, console, network requests and your actions, including frames. Start or stop: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>": "Запись захватывает видео вкладки, консоль, сетевые запросы и ваши действия, в том числе во фреймах. Начать или остановить: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>",
    "Recording not found": "Запись не найдена",
    "It has already been saved or deleted. You can close this tab.": "Её уже сохранили или удалили. Эту вкладку можно закрыть.",
    "Sign in to save the report": "Войдите, чтобы сохранить отчёт",
    "The recording is kept in the extension and will not be lost.": "Запись сохранена в расширении и никуда не пропадёт.",
    "Click to jump to this moment": "Нажмите, чтобы перейти к моменту",
    "Recorded events": "События записи",
    "Bug report": "Отчёт об ошибке",
    "Title": "Заголовок",
    "Description": "Описание",
    "Steps to reproduce, what you expected, what you got": "Шаги воспроизведения, что ожидали увидеть, что получили",
    "Project": "Проект",
    "Search by name, key or Jira ID": "Поиск по названию, ключу или ID в Jira",
    "Service": "Сервис",
    "Environment": "Окружение",
    "Not specified": "Не указано",
    "Taken from the service — you can pick another one": "Подставлено по сервису — можно выбрать другое",
    "Severity": "Важность",
    "Low": "Низкая",
    "Medium": "Средняя",
    "High": "Высокая",
    "Critical": "Критическая",
    "Tags": "Теги",
    "comma separated": "через запятую",
    "After the report is saved — an issue with links to the video, console and network": "После сохранения отчёта — задача со ссылкой на видео, консоль и сеть",
    "Delete recording": "Удалить запись",
    "Report saved": "Отчёт сохранён",
    "You can share the link with your colleagues.": "Ссылкой на него можно поделиться с коллегами.",
    "Open report": "Открыть отчёт",
    "Copy link": "Скопировать ссылку",
    "Close tab": "Закрыть вкладку"
  };
  var az = {
    "This site is not linked to a Bug Stream project": "Bu sayt Bug Stream layihəsinə bağlı deyil",
    "Recording is already running": "Qeyd artıq gedir",
    "This page cannot be recorded — open a site (http or https).": "Bu səhifəni qeydə almaq olmaz — saytı açın (http və ya https).",
    "Could not start recording": "Qeydi başlatmaq mümkün olmadı",
    "This page cannot be captured — open a site (http or https).": "Bu səhifənin şəklini çəkmək olmaz — saytı açın (http və ya https).",
    "Instant replay does not work on this page.": "Bu səhifədə instant replay işləmir.",
    "Instant replay is off — turn it on in the extension settings.": "Instant replay söndürülüb — onu genişlənmənin ayarlarında yandırın.",
    "There is no recording for this page yet. Instant replay starts when the page loads — reload it and try again later.": "Bu səhifə üçün hələ qeyd yoxdur. Instant replay səhifə yüklənəndə başlayır — səhifəni yeniləyin və bir az sonra təkrar edin.",
    "Could not write the video to disk: {error}": "Videonu diskə yazmaq mümkün olmadı: {error}",
    "The video was not recorded": "Video qeydə alınmadı",
    "Recording cancelled — no tab was selected": "Qeyd ləğv edildi — tab seçilmədi",
    "Paused — no activity": "Fasilə — fəaliyyət yoxdur",
    "Paused — tab hidden": "Fasilə — tab gizlidir",
    "Paused": "Fasilə",
    "Recording": "Qeyd gedir",
    "Resume": "Davam et",
    "Pause": "Fasilə",
    "This page cannot be recorded. Open the site where you found the bug.": "Bu səhifədə qeyd aparmaq olmaz. Xətanı tapdığınız saytı açın.",
    "Video": "Video",
    "Screenshot": "Skrinşot",
    "Open": "Aç",
    "Starting…": "Başladılır…",
    "Record tab": "Tabı qeydə al",
    "This recording is still running. Stop it and the report will open by itself.": "Bu qeyd hələ gedir. Onu dayandırın — hesabat özü açılacaq.",
    "New report": "Yeni hesabat",
    "Instant replay — last 2 minutes": "Instant replay — son 2 dəqiqə",
    "Could not open the page recording": "Səhifə qeydini açmaq mümkün olmadı",
    "Page screenshot": "Səhifənin skrinşotu",
    "No video": "Video yoxdur",
    "{n} console errors": ["konsolda {n} xəta", "konsolda {n} xəta"],
    "{n} network errors": ["{n} şəbəkə xətası", "{n} şəbəkə xətası"],
    "{n} requests": ["{n} sorğu", "{n} sorğu"],
    "{n} actions": ["{n} hərəkət", "{n} hərəkət"],
    "No events": "Hadisə yoxdur",
    "What went wrong": "Nə səhv getdi",
    "Nothing found": "Heç nə tapılmadı",
    "No project": "Layihəsiz",
    "Detected from the page address: {project} / {service}": "Səhifə ünvanına görə müəyyən edildi: {project} / {service}",
    "Create an issue in Jira ({key})": "Jira-da tapşırıq yarat ({key})",
    "Your Jira token has expired or was revoked.": "Jira tokeninizin müddəti bitib və ya ləğv edilib.",
    "Add your Jira API token to create issues.": "Tapşırıq yaratmaq üçün Jira API tokeninizi əlavə edin.",
    "Open profile": "Profili aç",
    "Not selected": "Seçilməyib",
    "Saving…": "Saxlanılır…",
    "Your session has expired — sign in to the extension again": "Sessiyanın müddəti bitib — genişlənməyə yenidən daxil olun",
    "The server rejected the report: {detail}": "Server hesabatı qəbul etmədi: {detail}",
    "Creating the Jira issue…": "Jira tapşırığı yaradılır…",
    "Jira issue created:": "Jira tapşırığı yaradıldı:",
    "Then send the report to Jira from its page.": "Sonra hesabatı öz səhifəsindən Jira-ya göndərin.",
    "The Jira issue was not created: {error}. You can send it from the report page.": "Jira tapşırığı yaradılmadı: {error}. Hesabat səhifəsindən göndərə bilərsiniz.",
    "Link copied": "Link kopyalandı",
    "The server is unreachable. The recording stays in the extension — try again.": "Server əlçatan deyil. Qeyd genişlənmədə qalıb — yenidən cəhd edin.",
    "Save report": "Hesabatı saxla",
    "Delete the recording without saving?": "Qeyd saxlanmadan silinsin?",
    "Wrong login or password": "Login və ya parol yanlışdır",
    "Your account is disabled — contact an administrator": "Hesabınız deaktiv edilib — administratora müraciət edin",
    "You are not in a group that has access to Bug Stream": "Siz Bug Stream-ə girişi olan qrupda deyilsiniz",
    "The corporate directory is not available, try again later": "Korporativ kataloq əlçatan deyil, bir az sonra cəhd edin",
    "The code is wrong or has expired — request a new one": "Kod yanlışdır və ya müddəti bitib — yenisini istəyin",
    "This sign-in method is turned off": "Bu giriş üsulu söndürülüb",
    "Too many attempts — wait a few minutes and try again": "Həddən çox cəhd — bir neçə dəqiqə gözləyin",
    "Enter a valid e-mail address": "Düzgün e-poçt ünvanı daxil edin",
    "Your session has expired — sign in again": "Sessiyanın müddəti bitib — yenidən daxil olun",
    "Server error. Try again.": "Server xətası. Yenidən cəhd edin.",
    "The server is unreachable. Check the address and that you are in the corporate network.": "Server əlçatan deyil. Ünvanı və korporativ şəbəkədə olduğunuzu yoxlayın.",
    "Server address": "Server ünvanı",
    "Address of the Bug Stream site in your network": "Şəbəkənizdə Bug Stream saytının ünvanı",
    "Password": "Parol",
    "E-mail code": "E-poçt kodu",
    "E-mail": "E-poçt",
    "We will send a one-time code — no password needed.": "Birdəfəlik kod göndərəcəyik — parol lazım deyil.",
    "Code from the e-mail": "Məktubdakı kod",
    "Another e-mail": "Başqa e-poçt",
    "Send again": "Yenidən göndər",
    "Work login or e-mail": "İş logini və ya e-poçt",
    "If {email} can sign in, a 6-digit code is on its way. It is valid for 10 minutes.": "Əgər {email} daxil ola bilirsə, 6 rəqəmli kod artıq yoldadır. Kod 10 dəqiqə etibarlıdır.",
    "Send code": "Kodu göndər",
    "Sign in": "Daxil ol",
    "Sending…": "Göndərilir…",
    "Signing in…": "Daxil olunur…",
    "Bug Stream recording": "Bug Stream qeydi",
    "Pause (no video is written, the timer stops)": "Fasilə (video yazılmır, vaxt dayanır)",
    "Stop recording and open the report": "Qeydi dayandır və hesabatı aç",
    "Stop": "Dayan",
    "Stop without saving": "Saxlamadan dayandır",
    "Cancel": "Ləğv et",
    "Stop recording without saving?": "Qeyd saxlanmadan dayandırılsın?",
    "Report a bug": "Xəta barədə bildir",
    "Stop recording": "Qeydi dayandır",
    "and open the report": "və hesabatı aç",
    "Record video": "Video qeydə al",
    "Chrome will ask which tab to record — choose this one and press “Share”": "Chrome hansı tabı qeydə almağı soruşacaq — bunu seçin və «Paylaş» düyməsini basın",
    "with console and network of the last minutes": "son dəqiqələrin konsolu və şəbəkəsi ilə",
    "Last 2 minutes": "Son 2 dəqiqə",
    "what happened on the page up to now": "bu ana qədər səhifədə baş verənlər",
    "turn on instant replay in the extension settings": "genişlənmənin ayarlarında instant replay-i yandırın",
    "The Bug Stream extension is unavailable — reload the page": "Bug Stream genişlənməsi əlçatan deyil — səhifəni yeniləyin",
    "Console": "Konsol",
    "Network": "Şəbəkə",
    "Action": "Hərəkət",
    "Navigation": "Keçid",
    "Log": "Log",
    "Paused — no activity. Resumes when you come back": "Fasilə — fəaliyyət yoxdur. Qayıdanda davam edəcək",
    "Open site": "Saytı aç",
    "Instant replay: save what happened on the page during the last 2 minutes": "Instant replay: son 2 dəqiqədə səhifədə baş verənləri saxla",
    "Last 2 min": "Son 2 dəq",
    "Stop and open the report": "Dayandır və hesabatı aç",
    "Unsaved recordings": "Saxlanmamış qeydlər",
    "Recording settings": "Qeyd ayarları",
    "Maximum video length": "Maksimal video uzunluğu",
    "5 minutes": "5 dəqiqə",
    "10 minutes": "10 dəqiqə",
    "20 minutes": "20 dəqiqə",
    "30 minutes": "30 dəqiqə",
    "The video is written to the computer's disk, not to memory. 10 minutes ≈ 110 MB.": "Video yaddaşa deyil, kompüterin diskinə yazılır. 10 dəqiqə ≈ 110 MB.",
    "Pause when nothing happens": "Heç nə baş vermədikdə fasilə",
    "No mouse movement or key presses for": "Siçan hərəkəti və düymə basılması yoxdursa:",
    "30 s": "30 san",
    "1 min": "1 dəq",
    "2 min": "2 dəq",
    "5 min": "5 dəq",
    "or the tab is hidden — recording pauses and resumes by itself when you come back.": "və ya tab gizlidirsə — qeyd fasiləyə düşür və qayıdanda özü davam edir.",
    "Instant replay on this site": "Bu saytda instant replay",
    "Language": "Dil",
    "Sign out": "Çıxış",
    "The extension keeps a recording of the last 2 minutes of the page in memory (no video — page snapshots). Nothing is sent until you press “Last 2 min” or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd>.": "Genişlənmə səhifənin son 2 dəqiqəlik qeydini daim yaddaşda saxlayır (video deyil — səhifə şəkilləri). «Son 2 dəq» və ya <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd> basana qədər heç nə göndərilmir.",
    "The recording captures the tab video, console, network requests and your actions, including frames. Start or stop: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>": "Qeyd tab videosunu, konsolu, şəbəkə sorğularını və hərəkətlərinizi, o cümlədən freymlərdə, tutur. Başlatmaq və ya dayandırmaq: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>",
    "Recording not found": "Qeyd tapılmadı",
    "It has already been saved or deleted. You can close this tab.": "O artıq saxlanılıb və ya silinib. Bu tabı bağlaya bilərsiniz.",
    "Sign in to save the report": "Hesabatı saxlamaq üçün daxil olun",
    "The recording is kept in the extension and will not be lost.": "Qeyd genişlənmədə saxlanılıb və itməyəcək.",
    "Click to jump to this moment": "Bu ana keçmək üçün klikləyin",
    "Recorded events": "Qeydin hadisələri",
    "Bug report": "Xəta hesabatı",
    "Title": "Başlıq",
    "Description": "Təsvir",
    "Steps to reproduce, what you expected, what you got": "Təkrarlama addımları, nə gözləyirdiniz, nə aldınız",
    "Project": "Layihə",
    "Search by name, key or Jira ID": "Ad, açar və ya Jira ID ilə axtarış",
    "Service": "Servis",
    "Environment": "Mühit",
    "Not specified": "Göstərilməyib",
    "Taken from the service — you can pick another one": "Servisə görə seçildi — başqasını seçə bilərsiniz",
    "Severity": "Ciddilik",
    "Low": "Aşağı",
    "Medium": "Orta",
    "High": "Yüksək",
    "Critical": "Kritik",
    "Tags": "Teqlər",
    "comma separated": "vergüllə ayırın",
    "After the report is saved — an issue with links to the video, console and network": "Hesabat saxlanandan sonra — video, konsol və şəbəkəyə linkli tapşırıq",
    "Delete recording": "Qeydi sil",
    "Report saved": "Hesabat saxlanıldı",
    "You can share the link with your colleagues.": "Linki həmkarlarınızla paylaşa bilərsiniz.",
    "Open report": "Hesabatı aç",
    "Copy link": "Linki kopyala",
    "Close tab": "Tabı bağla"
  };

  // src/shared/i18n.ts
  var DICTS = { en: enPlurals, ru, az };
  var current = browserLocale();
  function browserLocale() {
    const l = (navigator.language || "en").slice(0, 2).toLowerCase();
    return l === "ru" || l === "az" ? l : "en";
  }
  try {
    chrome.storage?.onChanged.addListener((changes, area) => {
      const l = changes.locale?.newValue;
      if (area === "local" && (l === "en" || l === "ru" || l === "az")) current = l;
    });
  } catch {
  }
  async function initI18n() {
    try {
      const { locale } = await chrome.storage.local.get("locale");
      if (locale === "en" || locale === "ru" || locale === "az") current = locale;
    } catch {
    }
    return current;
  }
  function intlLocale() {
    return current === "ru" ? "ru-RU" : current === "az" ? "az-Latn-AZ" : "en-GB";
  }
  function t(key, vars) {
    const v = DICTS[current][key] ?? DICTS.en[key] ?? key;
    let s;
    if (Array.isArray(v)) {
      const n = Number(vars?.n ?? 0);
      const cat = new Intl.PluralRules(intlLocale()).select(n);
      s = current === "ru" ? v[cat === "one" ? 0 : cat === "few" ? 1 : 2] ?? v[v.length - 1] : v[cat === "one" ? 0 : 1] ?? v[v.length - 1];
    } else {
      s = v;
    }
    if (vars) for (const [k, val] of Object.entries(vars)) s = s.split(`{${k}}`).join(val == null ? "" : String(val));
    return s;
  }

  // src/shared/types.ts
  var REPLAY_WINDOW_MS = 2 * 60 * 1e3;

  // src/core/filter.ts
  function networkMatcher(patterns) {
    const tests = patterns.map((p) => p.trim()).filter(Boolean).map((p) => {
      if (!p.includes("*")) {
        const needle = p.toLowerCase();
        return (u) => u.toLowerCase().includes(needle);
      }
      const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
      return (u) => re.test(u);
    });
    return (url) => tests.some((t2) => t2(url));
  }

  // src/offscreen.ts
  var CHUNK_MS = 2e3;
  var VIDEO_BITRATE = 15e5;
  void initI18n();
  var OPEN_END = Number.MAX_SAFE_INTEGER;
  var session = null;
  function pickMimeType() {
    for (const t2 of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
      if (MediaRecorder.isTypeSupported(t2)) return t2;
    }
    return "video/webm";
  }
  var send = (msg) => chrome.runtime.sendMessage(msg).catch(() => {
  });
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const s = session;
    switch (msg.type) {
      case "bt:offscreen-start":
        start(msg).then(
          (clock2) => sendResponse({ ok: true, startTs: session?.startTs, clock: clock2 }),
          (e) => sendResponse({ ok: false, error: String(e?.message ?? e) })
        );
        return true;
      case "bt:offscreen-stop":
        stop(msg.cancel).then(
          (recordingId) => sendResponse({ recordingId }),
          (e) => sendResponse({ recordingId: null, error: String(e?.message ?? e) })
        );
        return true;
      case "bt:offscreen-pause":
        if (s) msg.pause ? pause(s, msg.reason) : resume(s, true);
        sendResponse({ ok: !!s });
        return false;
      case "bt:event":
        if (s && sender.tab?.id === s.tabId) {
          const e = msg.event;
          if (e.kind === "network" && s.ignored(String(e.payload?.url ?? ""))) return false;
          s.events.push(e);
        }
        return false;
      case "bt:info":
        if (s && sender.tab?.id === s.tabId && !s.info) {
          s.info = msg.info;
          void saveMeta(s);
        }
        return false;
      case "bt:activity":
        if (s && sender.tab?.id === s.tabId) {
          s.lastActivity = Date.now();
          s.hidden = false;
          if (s.pauseReason === "idle" || s.pauseReason === "hidden") resume(s, false);
        }
        return false;
      case "bt:visibility":
        if (s && sender.tab?.id === s.tabId && sender.frameId === 0) {
          s.hidden = msg.hidden;
          if (msg.hidden && s.runningSince && s.idleMs) pause(s, "hidden");
          else if (!msg.hidden && s.pauseReason === "hidden") {
            s.lastActivity = Date.now();
            resume(s, false);
          }
        }
        return false;
    }
    return false;
  });
  async function start(msg) {
    if (session) throw new Error(t("Recording is already running"));
    const stream = msg.source === "desktop" ? await pickTab() : await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: msg.streamId,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30
        }
      }
    });
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITRATE });
    const now = Date.now();
    const s = {
      recordingId: msg.recordingId,
      tabId: msg.tabId,
      startTs: now,
      recorder,
      stream,
      mimeType,
      maxMs: msg.maxMs,
      idleMs: msg.idleMs,
      ignored: networkMatcher(msg.networkIgnore),
      seq: 0,
      writes: Promise.resolve(),
      writeError: null,
      events: [],
      eventSeq: 0,
      info: null,
      pauses: [],
      elapsedMs: 0,
      runningSince: now,
      pauseReason: null,
      lastActivity: now,
      hidden: false,
      ticker: 0,
      ticks: 0,
      stopping: false
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      const seq = s.seq++;
      const ts = Date.now();
      s.writes = s.writes.then(() => putChunk(s.recordingId, seq, e.data, ts)).catch((err) => {
        s.writeError = String(err?.message ?? err);
        console.error("Bug Stream: could not write a video chunk to disk", err);
        if (!s.stopping) void send({ type: "bt:offscreen-auto-stop" });
      });
    };
    await saveMeta(s);
    recorder.start(CHUNK_MS);
    session = s;
    s.ticker = window.setInterval(() => tick(s), 1e3);
    stream.getVideoTracks()[0]?.addEventListener("ended", () => void send({ type: "bt:offscreen-auto-stop" }));
    return clock(s);
  }
  function tick(s) {
    if (session !== s || s.stopping) return;
    const now = Date.now();
    if (s.runningSince && s.idleMs && now - s.lastActivity >= s.idleMs) pause(s, "idle");
    if (s.elapsedMs + (s.runningSince ? now - s.runningSince : 0) >= s.maxMs) {
      void send({ type: "bt:offscreen-auto-stop" });
      return;
    }
    if (++s.ticks % 5 === 0) flushEvents(s);
  }
  function flushEvents(s) {
    if (!s.events.length) return;
    const batch = s.events;
    s.events = [];
    const seq = s.eventSeq++;
    s.writes = s.writes.then(() => putEventBatch(s.recordingId, seq, batch)).catch(() => {
    });
  }
  function pause(s, reason) {
    if (!s.runningSince) {
      if (reason === "manual") s.pauseReason = "manual";
      else return;
    } else {
      const now = Date.now();
      s.elapsedMs += now - s.runningSince;
      s.runningSince = null;
      s.pauseReason = reason;
      s.pauses.push([now, OPEN_END]);
      if (s.recorder.state === "recording") {
        s.recorder.requestData();
        s.recorder.pause();
      }
      s.events.push({
        kind: "custom",
        ts: now,
        level: "info",
        summary: reason === "idle" ? "Paused: no activity" : reason === "hidden" ? "Paused: tab hidden" : "Paused",
        payload: { type: "pause", reason }
      });
    }
    void saveMeta(s);
    void send({ type: "bt:offscreen-clock", clock: clock(s) });
  }
  function resume(s, manual) {
    if (s.runningSince) return;
    if (s.pauseReason === "manual" && !manual) return;
    if (s.hidden && !manual) return;
    const now = Date.now();
    const open2 = s.pauses.at(-1);
    if (open2 && open2[1] === OPEN_END) open2[1] = now;
    s.runningSince = now;
    s.pauseReason = null;
    s.lastActivity = now;
    if (s.recorder.state === "paused") s.recorder.resume();
    s.events.push({ kind: "custom", ts: now, level: "info", summary: "Recording resumed", payload: { type: "resume" } });
    void saveMeta(s);
    void send({ type: "bt:offscreen-clock", clock: clock(s) });
  }
  var clock = (s) => ({ elapsedMs: s.elapsedMs, runningSince: s.runningSince, pauseReason: s.pauseReason, maxMs: s.maxMs });
  function saveMeta(s) {
    return putRecording(meta(s)).catch((e) => console.error("adtask:", e));
  }
  function meta(s) {
    return {
      id: s.recordingId,
      kind: "video",
      status: "recording",
      createdAt: s.startTs,
      startTs: s.startTs,
      durationMs: 0,
      tabId: s.tabId,
      info: s.info,
      events: [],
      mimeType: s.mimeType,
      chunkCount: 0,
      pauses: s.pauses.map((p) => [p[0], p[1]]),
      screenshot: null,
      replay: null
    };
  }
  async function stop(cancel) {
    const s = session;
    if (!s) return null;
    s.stopping = true;
    session = null;
    clearInterval(s.ticker);
    const stopped = new Promise((resolve) => s.recorder.onstop = () => resolve());
    if (s.recorder.state !== "inactive") s.recorder.stop();
    await stopped;
    const stopTs = s.runningSince ? Date.now() : s.pauses.at(-1)?.[0] ?? Date.now();
    s.stream.getTracks().forEach((t2) => t2.stop());
    flushEvents(s);
    await s.writes;
    if (cancel || s.seq === 0) {
      await deleteRecording(s.recordingId);
      if (!cancel) throw new Error(s.writeError ? t("Could not write the video to disk: {error}", { error: s.writeError }) : t("The video was not recorded"));
      return null;
    }
    const events = await getEventBatches(s.recordingId);
    const r = finishRecording({ ...meta(s), chunkCount: s.seq }, events, stopTs);
    await putRecording(r);
    await clearEventBatches(s.recordingId);
    return s.recordingId;
  }
  async function pickTab() {
    try {
      return await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser", width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 30 } },
        audio: false,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
        monitorTypeSurfaces: "exclude"
      });
    } catch (e) {
      if (e?.name === "NotAllowedError") throw new Error(t("Recording cancelled — no tab was selected"));
      throw e;
    }
  }
})();
