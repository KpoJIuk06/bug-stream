"use strict";
(() => {
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
  async function saveLocale(l) {
    if (l !== "en" && l !== "ru" && l !== "az") return;
    current = l;
    await chrome.storage.local.set({ locale: l });
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

  // src/shared/api.ts
  var DEFAULT_SERVER = "http://localhost";
  var DEFAULTS = { server: DEFAULT_SERVER, accessToken: null, refreshToken: null, user: null };
  async function getSettings() {
    const s = await chrome.storage.local.get(DEFAULTS);
    const own = await chrome.storage.local.get("server");
    if (!own.server) {
      const managed = await chrome.storage.managed.get("server").catch(() => ({}));
      if (typeof managed.server === "string" && managed.server.trim()) s.server = normalizeServer(managed.server);
    }
    return s;
  }
  async function saveSettings(patch) {
    await chrome.storage.local.set(patch);
  }
  function normalizeServer(raw) {
    let s = raw.trim().replace(/\/+$/, "");
    if (s && !/^https?:\/\//i.test(s)) s = (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(s) ? "http://" : "https://") + s;
    return s;
  }
  var ApiError = class extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
    status;
    code;
  };
  async function parseError(res) {
    let body = {};
    try {
      body = await res.json();
    } catch {
    }
    return new ApiError(res.status, body.code, body.detail ?? `HTTP ${res.status}`);
  }
  var refreshing = null;
  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const s = await getSettings();
      if (!s.refreshToken) return false;
      try {
        const res = await fetch(`${s.server}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: s.refreshToken })
        });
        if (!res.ok) {
          await saveSettings({ accessToken: null, refreshToken: null, user: null });
          return false;
        }
        const tokens = await res.json();
        await saveSettings({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user });
        await saveLocale(tokens.user?.locale);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }
  async function api(path, init = {}) {
    const send = async () => {
      const s = await getSettings();
      const headers = new Headers(init.headers);
      if (s.accessToken) headers.set("Authorization", `Bearer ${s.accessToken}`);
      if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      return fetch(`${s.server}${path}`, { ...init, headers });
    };
    let res = await send();
    if (res.status === 401 && await refresh()) res = await send();
    if (!res.ok) throw await parseError(res);
    const text = await res.text();
    return text ? JSON.parse(text) : void 0;
  }
  async function resolveProject(url) {
    const s = await getSettings();
    if (!s.refreshToken) return null;
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3e3));
    const request = api(`/api/projects/resolve?url=${encodeURIComponent(url)}`).catch(() => null);
    return Promise.race([request, timeout]);
  }

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
  var listRecordings = () => run(RECORDINGS, "readonly", (t2) => t2.objectStore(RECORDINGS).getAll());
  var deleteRecording = (id) => run([RECORDINGS, CHUNKS, EVENTS], "readwrite", (t2) => {
    t2.objectStore(RECORDINGS).delete(id);
    t2.objectStore(CHUNKS).delete(range(id));
    t2.objectStore(EVENTS).delete(range(id));
  });
  async function lastChunk(rid) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(CHUNKS).objectStore(CHUNKS).openCursor(range(rid), "prev");
      req.onsuccess = () => resolve(req.result ? { seq: req.result.value.seq, ts: req.result.value.ts } : null);
      req.onerror = () => reject(req.error);
    });
  }
  async function getEventBatches(rid) {
    const rows = await run(EVENTS, "readonly", (t2) => t2.objectStore(EVENTS).getAll(range(rid)));
    return rows.sort((a, b) => a.seq - b.seq).flatMap((r) => r.events);
  }
  var clearEventBatches = (rid) => run(EVENTS, "readwrite", (t2) => void t2.objectStore(EVENTS).delete(range(rid)));
  async function cleanupOldRecordings() {
    const limit = Date.now() - 3 * 24 * 3600 * 1e3;
    for (const r of await listRecordings()) {
      if (r.createdAt < limit) await deleteRecording(r.id);
    }
  }
  async function recoverInterrupted(isActive) {
    const recovered = [];
    for (const r of await listRecordings()) {
      if (r.status !== "recording" || isActive(r.id)) continue;
      const last = await lastChunk(r.id);
      if (!last) {
        await deleteRecording(r.id);
        continue;
      }
      const events = await getEventBatches(r.id);
      const finished = finishRecording({ ...r, chunkCount: last.seq + 1 }, events, last.ts);
      await putRecording(finished);
      await clearEventBatches(r.id);
      recovered.push(r.id);
    }
    return recovered;
  }
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

  // src/shared/types.ts
  var DEFAULT_PREFS = { maxMinutes: 10, autoPause: true, idleSeconds: 60, instantReplay: false, replayExcluded: [] };
  var IDLE_STATE = {
    status: "idle",
    tabId: null,
    recordingId: null,
    startTs: null,
    elapsedMs: 0,
    runningSince: null,
    pauseReason: null,
    maxMs: 0
  };
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
  function filterNetwork(events, patterns) {
    if (!patterns.length) return events;
    const ignored = networkMatcher(patterns);
    return events.filter((e) => e.kind !== "network" || !ignored(String(e.payload?.url ?? "")));
  }

  // src/shared/prefs.ts
  async function getPrefs() {
    const { prefs } = await chrome.storage.local.get({ prefs: DEFAULT_PREFS });
    return { ...DEFAULT_PREFS, ...prefs };
  }

  // src/background.ts
  async function getState() {
    const { state } = await chrome.storage.session.get({ state: IDLE_STATE });
    return { ...IDLE_STATE, ...state };
  }
  var setState = (state) => chrome.storage.session.set({ state });
  void initI18n();
  var errorOf = (e) => String(e?.message ?? e);
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case "bt:start-request":
        startRecording(msg.tabId).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
        return true;
      case "bt:stop-request":
        stopRecording(!!msg.cancel).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
        return true;
      case "bt:pause-request":
        setPaused(msg.pause).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
        return true;
      case "bt:screenshot-request":
        takeScreenshot(msg.tabId).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
        return true;
      case "bt:replay-request":
        saveReplay(msg.tabId).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
        return true;
      case "bt:state?":
        getState().then((s) => {
          const mine = s.status === "recording" && sender.tab?.id === s.tabId;
          sendResponse({ recording: mine, clock: mine ? clockOf(s) : null });
        });
        return true;
      case "bt:replay-inject":
        if (sender.tab?.id != null && sender.frameId === 0) {
          void chrome.scripting.executeScript({ target: { tabId: sender.tab.id, frameIds: [0] }, files: ["content-replay.js"] }).catch(() => {
          });
        }
        return false;
      case "bt:api-allowed?":
        apiAllowed(sender.tab?.url).then((allowed) => sendResponse({ allowed }), () => sendResponse({ allowed: false }));
        return true;
      case "bt:page-command": {
        const tab = sender.tab;
        if (tab?.id == null || sender.frameId !== 0) return false;
        const tabId = tab.id;
        apiAllowed(tab.url).then((ok) => {
          if (!ok) throw new Error(t("This site is not linked to a Bug Stream project"));
          if (msg.cmd === "record") return startRecording(tabId, "desktop");
          if (msg.cmd === "screenshot") return takeScreenshot(tabId);
          return saveReplay(tabId);
        }).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
        return true;
      }
      case "bt:offscreen-clock":
        void onClock(msg.clock);
        return false;
      case "bt:offscreen-auto-stop":
        void stopRecording(false);
        return false;
    }
    return false;
  });
  chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (command === "toggle-recording") {
      const state = await getState();
      if (state.status === "recording") return void await stopRecording(false);
      if (tab?.id) await startRecording(tab.id).catch((e) => console.warn("Bug Stream: could not start recording", e));
    } else if (command === "save-replay") {
      if (tab?.id) await saveReplay(tab.id).catch((e) => console.warn("Bug Stream: could not save the replay", e));
    }
  });
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const state = await getState();
    if (state.status === "recording" && state.tabId === tabId) await stopRecording(false);
  });
  chrome.runtime.onStartup.addListener(() => void housekeeping(true));
  chrome.runtime.onInstalled.addListener(() => void housekeeping(false));
  async function housekeeping(browserStarted) {
    if (browserStarted) await setState(IDLE_STATE);
    const state = await getState();
    const active = state.status !== "idle" && await hasOffscreen() ? state.recordingId : null;
    if (!active && state.status !== "idle") await setState(IDLE_STATE);
    const recovered = await recoverInterrupted((id) => id === active).catch(() => []);
    await cleanupOldRecordings().catch(() => {
    });
    if (recovered.length) {
      await chrome.action.setBadgeBackgroundColor({ color: "#0d6e6e" });
      await chrome.action.setBadgeText({ text: String(recovered.length) });
    }
  }
  var clockOf = (s) => ({ elapsedMs: s.elapsedMs, runningSince: s.runningSince, pauseReason: s.pauseReason, maxMs: s.maxMs });
  async function apiAllowed(url) {
    if (!url || !/^https?:/.test(url)) return false;
    const origin = new URL(url).origin;
    const key = "api:" + origin;
    const cached = (await chrome.storage.session.get(key))[key];
    if (cached && Date.now() - cached.at < 10 * 6e4) return cached.allowed;
    const project = await resolveProject(url);
    const allowed = !!project?.matched;
    await chrome.storage.session.set({ [key]: { allowed, at: Date.now() } });
    return allowed;
  }
  async function startRecording(tabId, source = "tab") {
    const state = await getState();
    if (state.status !== "idle") {
      if (!await hasOffscreen()) await setState(IDLE_STATE);
      else throw new Error(t("Recording is already running"));
    }
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !/^https?:/.test(tab.url)) throw new Error(t("This page cannot be recorded — open a site (http or https)."));
    const streamId = source === "tab" ? await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }) : "";
    await setState({ ...IDLE_STATE, status: "starting", tabId });
    try {
      const [prefs, project] = await Promise.all([getPrefs(), resolveProject(tab.url)]);
      await ensureContentScripts(tabId);
      await ensureOffscreen();
      const recordingId = crypto.randomUUID();
      const maxMs = prefs.maxMinutes * 6e4;
      const res = await chrome.runtime.sendMessage({
        type: "bt:offscreen-start",
        target: "offscreen",
        streamId,
        recordingId,
        tabId,
        maxMs,
        idleMs: prefs.autoPause ? prefs.idleSeconds * 1e3 : null,
        networkIgnore: project?.networkIgnore ?? [],
        source
      });
      if (!res?.ok || !res.startTs || !res.clock) throw new Error(res?.error ?? t("Could not start recording"));
      const next = { ...IDLE_STATE, status: "recording", tabId, recordingId, startTs: res.startTs, ...res.clock };
      await setState(next);
      await chrome.tabs.sendMessage(tabId, { type: "bt:start", clock: res.clock }).catch(() => {
      });
      await setBadge(next);
      return { ok: true, startTs: res.startTs };
    } catch (e) {
      await setState(IDLE_STATE);
      await closeOffscreen();
      throw e;
    }
  }
  async function setPaused(pause) {
    const state = await getState();
    if (state.status !== "recording") return { ok: false };
    await chrome.runtime.sendMessage({ type: "bt:offscreen-pause", target: "offscreen", pause, reason: "manual" });
    return { ok: true };
  }
  async function onClock(clock) {
    const state = await getState();
    if (state.status !== "recording") return;
    const next = { ...state, ...clock };
    await setState(next);
    await setBadge(next);
    if (state.tabId != null) {
      await chrome.tabs.sendMessage(state.tabId, { type: "bt:clock", clock }, { frameId: 0 }).catch(() => {
      });
    }
  }
  async function setBadge(s) {
    const paused = s.status === "recording" && !s.runningSince;
    await chrome.action.setBadgeBackgroundColor({ color: paused ? "#8a94a3" : "#d1343e" });
    await chrome.action.setBadgeText({ text: s.status === "recording" ? paused ? "II" : "REC" : "" });
  }
  async function stopRecording(cancel) {
    const state = await getState();
    if (state.status !== "recording" && state.status !== "starting") return { ok: false };
    await setState({ ...state, status: "stopping" });
    if (state.tabId != null) await chrome.tabs.sendMessage(state.tabId, { type: "bt:stop" }).catch(() => {
    });
    await chrome.action.setBadgeText({ text: "" });
    let recordingId = null;
    let error;
    try {
      const res = await chrome.runtime.sendMessage({
        type: "bt:offscreen-stop",
        target: "offscreen",
        cancel
      });
      recordingId = res?.recordingId ?? null;
      error = res?.error;
      if (error) console.warn("adtask:", error);
    } finally {
      await closeOffscreen();
      await setState(IDLE_STATE);
    }
    if (!cancel && recordingId) await openPreview(recordingId, state.tabId);
    if (error) throw new Error(error);
    return { ok: true, recordingId };
  }
  async function collectBuffers(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => globalThis.__adtaskBuffer?.() ?? []
    }).catch(() => []);
    return results.flatMap((r) => r.result ?? []).sort((a, b) => a.ts - b.ts);
  }
  async function collectInfo(tabId) {
    const [r] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => globalThis.__adtaskInfo?.() ?? null }).catch(() => []);
    return r?.result ?? null;
  }
  async function takeScreenshot(tabId) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !/^https?:/.test(tab.url)) throw new Error(t("This page cannot be captured — open a site (http or https)."));
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const screenshot = await (await fetch(dataUrl)).blob();
    await ensureContentScripts(tabId);
    const [buffer, info, project] = await Promise.all([collectBuffers(tabId), collectInfo(tabId), resolveProject(tab.url)]);
    const events = filterNetwork(buffer, project?.networkIgnore ?? []);
    const now = Date.now();
    const first = events.length ? events[0].ts : now;
    const id = crypto.randomUUID();
    await putRecording({
      id,
      kind: "screenshot",
      status: "done",
      createdAt: now,
      startTs: first,
      durationMs: now - first,
      tabId,
      info,
      events: events.map((e) => ({ ...e, t: e.ts - first })),
      mimeType: null,
      chunkCount: 0,
      pauses: [],
      screenshot,
      replay: null
    });
    await openPreview(id, tabId);
    return { ok: true, recordingId: id };
  }
  async function saveReplay(tabId) {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !/^https?:/.test(tab.url)) throw new Error(t("Instant replay does not work on this page."));
    const prefs = await getPrefs();
    if (!prefs.instantReplay) throw new Error(t("Instant replay is off — turn it on in the extension settings."));
    const [r] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => globalThis.__adtaskReplay?.() ?? null }).catch(() => []);
    const dom = r?.result;
    if (!dom || dom.events.length < 2) {
      throw new Error(t("There is no recording for this page yet. Instant replay starts when the page loads — reload it and try again later."));
    }
    const [buffer, info, project] = await Promise.all([collectBuffers(tabId), collectInfo(tabId), resolveProject(tab.url)]);
    const startTs = dom.events[0].timestamp;
    const endTs = Math.max(Date.now(), dom.events.at(-1).timestamp);
    const events = filterNetwork(buffer, project?.networkIgnore ?? []).filter((e) => e.ts >= startTs - 1e3).map((e) => ({ ...e, t: Math.max(0, e.ts - startTs) }));
    const json = new Blob([JSON.stringify(dom.events)], { type: "application/json" });
    const replay = await new Response(json.stream().pipeThrough(new CompressionStream("gzip"))).blob();
    const id = crypto.randomUUID();
    await putRecording({
      id,
      kind: "replay",
      status: "done",
      createdAt: Date.now(),
      startTs,
      durationMs: endTs - startTs,
      tabId,
      info,
      events,
      mimeType: null,
      chunkCount: 0,
      pauses: [],
      screenshot: null,
      replay: new Blob([replay], { type: "application/gzip" })
    });
    await openPreview(id, tabId);
    return { ok: true, recordingId: id, windowMs: REPLAY_WINDOW_MS };
  }
  async function openPreview(recordingId, sourceTabId) {
    let index;
    if (sourceTabId != null) {
      const src = await chrome.tabs.get(sourceTabId).catch(() => null);
      if (src) index = src.index + 1;
    }
    await chrome.tabs.create({ url: chrome.runtime.getURL(`preview.html?id=${recordingId}`), index });
  }
  async function ensureContentScripts(tabId) {
    const alive = await chrome.tabs.sendMessage(tabId, { type: "bt:ping" }, { frameId: 0 }).catch(() => null);
    if (alive) return;
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content-main.js"], world: "MAIN" }).catch(() => {
    });
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content-isolated.js"] }).catch(() => {
    });
  }
  async function hasOffscreen() {
    const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
    return contexts.length > 0;
  }
  async function ensureOffscreen() {
    if (await hasOffscreen()) return;
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
      justification: "Recording the tab video for a bug report"
    });
  }
  async function closeOffscreen() {
    if (await hasOffscreen()) await chrome.offscreen.closeDocument().catch(() => {
    });
  }
})();
