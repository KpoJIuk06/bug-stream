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
  var DEFAULT_PREFS = { maxMinutes: 10, autoPause: true, idleSeconds: 60, instantReplay: false, replayExcluded: [] };
  var currentElapsed = (s, now = Date.now()) => s.elapsedMs + (s.runningSince ? now - s.runningSince : 0);
  var REPLAY_WINDOW_MS = 2 * 60 * 1e3;

  // src/shared/prefs.ts
  async function getPrefs() {
    const { prefs } = await chrome.storage.local.get({ prefs: DEFAULT_PREFS });
    return { ...DEFAULT_PREFS, ...prefs };
  }

  // src/core/page-actions.ts
  function installActionCapture(handle, isOurUi) {
    let lastLabelClick = { control: null, ts: 0 };
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (!target || isOurUi(target)) return;
        if (e.detail > 1) return;
        if (lastLabelClick.control === target && Date.now() - lastLabelClick.ts < 300) return;
        const labelEl = target.closest("label");
        if (labelEl) lastLabelClick = { control: labelEl.control, ts: Date.now() };
        const el = target.closest("a,button,[role=button],input,select,textarea,label,summary,[onclick],[role=tab],[role=menuitem],[role=option]") ?? target;
        const label = labelOf(el);
        handle({
          kind: "action",
          ts: Date.now(),
          level: "click",
          summary: label ? `Click "${label}"` : `Click on ${el.tagName.toLowerCase()}`,
          payload: {
            selector: selectorOf(el),
            tag: el.tagName.toLowerCase(),
            text: label || void 0,
            href: el.href || void 0,
            x: Math.round(e.clientX),
            y: Math.round(e.clientY)
          }
        });
      },
      true
    );
    document.addEventListener(
      "dblclick",
      (e) => {
        const target = e.target;
        if (!target || isOurUi(target)) return;
        const el = target.closest("a,button,[role=button],input,select,textarea,label,td,li") ?? target;
        const label = labelOf(el);
        handle({
          kind: "action",
          ts: Date.now(),
          level: "dblclick",
          summary: label ? `Double click "${label}"` : `Double click on ${el.tagName.toLowerCase()}`,
          payload: { selector: selectorOf(el), tag: el.tagName.toLowerCase(), text: label || void 0 }
        });
      },
      true
    );
    const pending = /* @__PURE__ */ new Map();
    const lastValue = /* @__PURE__ */ new WeakMap();
    const reportInput = (el) => {
      pending.delete(el);
      const raw = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? String(el.checked) : el.value;
      if (lastValue.get(el) === raw) return;
      lastValue.set(el, raw);
      const label = fieldLabel(el);
      let value;
      if (el instanceof HTMLSelectElement) value = el.selectedOptions[0]?.text ?? el.value;
      else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) value = el.checked ? "checked" : "unchecked";
      else if (el instanceof HTMLInputElement && el.type === "password") value = "•".repeat(Math.min(el.value.length, 12));
      else value = el.value.length > 500 ? el.value.slice(0, 500) + "…" : el.value;
      handle({
        kind: "action",
        ts: Date.now(),
        level: el instanceof HTMLSelectElement || el.type === "checkbox" || el.type === "radio" ? "change" : "input",
        summary: `${el instanceof HTMLSelectElement ? "Select" : "Input"} "${label}": ${value || "(empty)"}`,
        payload: { selector: selectorOf(el), tag: el.tagName.toLowerCase(), type: el.type, value }
      });
    };
    document.addEventListener(
      "input",
      (e) => {
        const el = e.target;
        if (!el || isOurUi(el) || !("value" in el)) return;
        clearTimeout(pending.get(el));
        pending.set(el, window.setTimeout(() => reportInput(el), 800));
      },
      true
    );
    document.addEventListener(
      "change",
      (e) => {
        const el = e.target;
        if (!el || isOurUi(el) || !("value" in el)) return;
        clearTimeout(pending.get(el));
        reportInput(el);
      },
      true
    );
    document.addEventListener(
      "submit",
      (e) => {
        const form = e.target;
        handle({
          kind: "action",
          ts: Date.now(),
          level: "submit",
          summary: `Form submit${form.getAttribute("name") ? ` "${form.getAttribute("name")}"` : ""}`,
          payload: { selector: selectorOf(form), action: form.action || void 0 }
        });
      },
      true
    );
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter" && e.key !== "Escape") return;
        if (isOurUi(e.target)) return;
        handle({
          kind: "action",
          ts: Date.now(),
          level: "key",
          summary: `Key ${e.key}`,
          payload: { key: e.key, selector: selectorOf(e.target) }
        });
      },
      true
    );
  }
  function clean(s, max = 60) {
    const t2 = (s ?? "").replace(/\s+/g, " ").trim();
    return t2.length > max ? t2.slice(0, max) + "…" : t2;
  }
  function labelOf(el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      if (el instanceof HTMLInputElement && ["button", "submit", "reset"].includes(el.type)) return clean(el.value);
      return fieldLabel(el);
    }
    return clean(el.getAttribute("aria-label")) || clean(el.innerText) || clean(el.getAttribute("title")) || clean(el.alt) || "";
  }
  function fieldLabel(el) {
    const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    const wrapping = el.closest("label");
    const labelledBy = el.getAttribute("aria-labelledby");
    const byAria = labelledBy ? document.getElementById(labelledBy.split(" ")[0]) : null;
    return clean(el.getAttribute("aria-label")) || clean(byFor?.textContent) || clean(byAria?.textContent) || clean(wrapping?.textContent) || clean(el.placeholder) || clean(el.name) || el.tagName.toLowerCase();
  }
  var isGeneratedClass = (c) => /\d|_|[A-Z]/.test(c) || c.length > 32 || /^(active|hover|focus|selected|open|show|is-|has-)/.test(c) || /^(css|sc|jsx|svelte|prc)-/.test(c);
  function stableAttr(node) {
    for (const attr of ["data-testid", "data-test", "data-qa", "data-cy", "name", "aria-label"]) {
      const v = node.getAttribute(attr);
      if (v && v.length <= 60) return `${node.tagName.toLowerCase()}[${attr}="${v.replace(/"/g, '\\"')}"]`;
    }
    return null;
  }
  function selectorOf(el) {
    if (!el || !(el instanceof Element)) return "";
    const parts = [];
    let node = el;
    for (let depth = 0; node && depth < 4 && node !== document.body; depth++) {
      if (node.id && !/\d{3,}|[:.]/.test(node.id)) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const stable = stableAttr(node);
      if (stable) {
        parts.unshift(stable);
        break;
      }
      let part = node.tagName.toLowerCase();
      const classes = [...node.classList].filter((c) => !isGeneratedClass(c)).slice(0, 2);
      if (classes.length) part += "." + classes.map((c) => CSS.escape(c)).join(".");
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(" > ");
  }
  async function collectInfo() {
    const nav = navigator;
    let os = nav.userAgentData?.platform || navigator.platform || "";
    let osVersion = null;
    let browser = "Chrome";
    let browserVersion = null;
    try {
      const hi = await nav.userAgentData?.getHighEntropyValues(["platformVersion", "fullVersionList"]);
      if (hi) {
        if (os === "Windows" && hi.platformVersion) osVersion = Number(hi.platformVersion.split(".")[0]) >= 13 ? "11" : "10";
        else if (hi.platformVersion) osVersion = hi.platformVersion;
        const brand = hi.fullVersionList?.find(
          (b) => /Google Chrome|Microsoft Edge|Opera|Yandex|Chromium/.test(b.brand)
        );
        if (brand) {
          browser = brand.brand.replace("Google ", "");
          browserVersion = brand.version;
        }
      }
    } catch {
    }
    if (!browserVersion) browserVersion = /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? null;
    if (os === "macOS" || os === "MacIntel") os = "macOS";
    const conn = nav.connection;
    const region = navigator.language.split("-")[1];
    let location2 = null;
    try {
      location2 = region ? new Intl.DisplayNames(["en"], { type: "region" }).of(region.toUpperCase()) ?? null : null;
    } catch {
    }
    return {
      pageUrl: window.location.href,
      pageTitle: document.title,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
      location: location2,
      os,
      osVersion,
      browser,
      browserVersion,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      screenSize: `${screen.width}x${screen.height}`,
      devicePixelRatio: Math.round(window.devicePixelRatio * 100) / 100,
      networkType: conn?.effectiveType ?? null,
      networkDownlink: conn?.downlink ?? null,
      networkRtt: conn?.rtt ?? null
    };
  }

  // src/content/isolated.ts
  var TAG = "__adtask";
  var BUFFER_MS = 5 * 60 * 1e3;
  var BUFFER_MAX = 1500;
  var ACTIVITY_THROTTLE_MS = 3e3;
  var w = window;
  var isTop = window === window.top;
  if (!w[TAG + "Isolated"]) {
    w[TAG + "Isolated"] = true;
    if (isTop) void initI18n();
    init();
  }
  function init() {
    let recording = false;
    const buffer = [];
    const frame = isTop ? void 0 : location.href;
    const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => {
    });
    const recent = /* @__PURE__ */ new Map();
    function isDuplicate(event) {
      if (event.kind !== "action" && event.kind !== "navigation") return false;
      const key = event.kind === "navigation" ? `nav|${String(event.payload?.to ?? "").replace(/#.*$/, "")}` : `act|${event.level}|${event.summary}|${event.payload?.selector ?? ""}`;
      const window2 = event.kind === "navigation" ? 5e3 : 700;
      const prev = recent.get(key);
      recent.set(key, event.ts);
      if (recent.size > 200) recent.delete(recent.keys().next().value);
      return prev != null && event.ts - prev < window2;
    }
    function handle(event) {
      if (isDuplicate(event)) return;
      if (frame) event = { ...event, payload: { ...event.payload, frame } };
      buffer.push(event);
      const cutoff = Date.now() - BUFFER_MS;
      while (buffer.length > BUFFER_MAX || buffer.length && buffer[0].ts < cutoff) buffer.shift();
      if (recording) send({ type: "bt:event", event });
    }
    let appContext = {};
    const contextEvent = () => ({
      kind: "custom",
      ts: Date.now(),
      level: "info",
      summary: "App context: " + Object.entries(appContext).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ").slice(0, 300),
      payload: { type: "app-context", context: appContext }
    });
    const hasContext = () => Object.keys(appContext).length > 0;
    w.__adtaskBuffer = () => hasContext() ? [...buffer, contextEvent()] : buffer.slice();
    if (isTop) w.__adtaskInfo = () => collectInfo();
    window.addEventListener("message", (e) => {
      if (e.source !== window || !e.data || e.data[TAG] !== 1) return;
      if (e.data.event) handle(e.data.event);
      else if (e.data.cmd && isTop && apiAllowed) onPageCommand(String(e.data.cmd), e.data.data);
    });
    let apiAllowed = false;
    const postToPage = (data) => window.postMessage({ [TAG]: 1, ...data }, location.origin);
    function onPageCommand(cmd, data) {
      switch (cmd) {
        case "report":
          showActionMenu(recording);
          break;
        case "record":
        case "screenshot":
        case "replay":
          pageCommand(cmd);
          break;
        case "context":
          appContext = data && typeof data === "object" ? data : {};
          if (recording && hasContext()) handle(contextEvent());
          break;
        case "log": {
          const d = data ?? {};
          handle({ kind: "custom", ts: Date.now(), level: "info", summary: String(d.message ?? ""), payload: { type: "log", data: d.data ?? void 0 } });
          break;
        }
      }
    }
    if (isTop) {
      chrome.runtime.sendMessage({ type: "bt:api-allowed?" }).then((r) => {
        if (!r?.allowed) return;
        apiAllowed = true;
        postToPage({ enable: { version: chrome.runtime.getManifest().version } });
        if (recording) postToPage({ state: { recording: true } });
      }).catch(() => {
      });
    }
    let lastActivitySent = 0;
    const activity = () => {
      if (!recording) return;
      const now = Date.now();
      if (now - lastActivitySent < ACTIVITY_THROTTLE_MS) return;
      lastActivitySent = now;
      send({ type: "bt:activity" });
    };
    for (const type of ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart", "input"]) {
      window.addEventListener(type, activity, { capture: true, passive: true });
    }
    if (isTop) {
      let hideTimer = 0;
      let unloading = false;
      window.addEventListener("pagehide", () => unloading = true);
      window.addEventListener("pageshow", () => unloading = false);
      document.addEventListener("visibilitychange", () => {
        if (!recording) return;
        clearTimeout(hideTimer);
        if (document.visibilityState === "hidden") {
          if (unloading) return;
          hideTimer = window.setTimeout(() => {
            if (recording && document.visibilityState === "hidden") send({ type: "bt:visibility", hidden: true });
          }, 1500);
        } else {
          send({ type: "bt:visibility", hidden: false });
        }
      });
    }
    installActionCapture(handle, (el) => !!el?.closest?.("adtask-recorder"));
    const startRecording = (clock, kind) => {
      recording = true;
      lastActivitySent = 0;
      if (!isTop) return;
      collectInfo().then((info) => send({ type: "bt:info", info }));
      if (hasContext()) handle(contextEvent());
      if (apiAllowed) postToPage({ state: { recording: true } });
      handle({
        kind: "navigation",
        ts: Date.now(),
        summary: kind === "start" ? `Recording started on ${location.pathname}${location.search}` : `Page loaded ${location.pathname}${location.search}`,
        payload: { to: location.href, type: kind }
      });
      send({ type: "bt:visibility", hidden: document.visibilityState === "hidden" });
      const show = () => showRecorder(clock);
      if (document.body) show();
      else document.addEventListener("DOMContentLoaded", show, { once: true });
    };
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      switch (msg.type) {
        case "bt:ping":
          sendResponse({ ok: true });
          return false;
        case "bt:start":
          startRecording(msg.clock, "start");
          sendResponse({ ok: true });
          return false;
        case "bt:clock":
          if (isTop) updateRecorder(msg.clock);
          return false;
        case "bt:stop":
          recording = false;
          if (isTop) hideRecorder();
          if (isTop && apiAllowed) postToPage({ state: { recording: false } });
          sendResponse({ ok: true });
          return false;
      }
      return false;
    });
    chrome.runtime.sendMessage({ type: "bt:state?" }).then((state) => {
      if (state?.recording && state.clock) startRecording(state.clock, "load");
    }).catch(() => {
    });
    if (isTop) void setupInstantReplay();
  }
  async function setupInstantReplay() {
    const enabled = (p) => p.instantReplay && !p.replayExcluded.includes(location.origin);
    let requested = false;
    const maybeInject = (p) => {
      if (requested || !enabled(p)) return;
      requested = true;
      chrome.runtime.sendMessage({ type: "bt:replay-inject" }).catch(() => requested = false);
    };
    maybeInject(await getPrefs());
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.prefs) void getPrefs().then(maybeInject);
    });
  }
  var recorderHost = null;
  var barClock = null;
  var timer = 0;
  var ui = null;
  var fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1e3));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  var PAUSE_TEXT = {
    idle: "Paused — no activity. Resumes when you come back",
    hidden: "Paused — tab hidden",
    manual: "Paused"
  };
  function showRecorder(clock) {
    barClock = clock;
    if (recorderHost) return updateRecorder(clock);
    recorderHost = document.createElement("adtask-recorder");
    const root = recorderHost.attachShadow({ mode: "closed" });
    root.innerHTML = `
    <style>
      :host { all: initial; }
      .bar { position: fixed; z-index: 2147483647; left: 50%; bottom: 20px; transform: translateX(-50%);
        display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; border-radius: 999px;
        background: #18202c; color: #fff; font: 500 13px/1 system-ui, "Segoe UI", sans-serif;
        box-shadow: 0 10px 30px -8px rgba(0,0,0,.45); user-select: none; max-width: calc(100vw - 32px); }
      .dot { width: 9px; height: 9px; border-radius: 50%; background: #ff5d68; animation: pulse 1.2s ease-in-out infinite; flex: none; }
      .paused .dot { background: #8a94a3; animation: none; }
      @keyframes pulse { 50% { opacity: .35; } }
      @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
      .time { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .time small { color: rgba(255,255,255,.5); font-size: 11px; }
      .state { color: #ffd479; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .state:empty { display: none; }
      button { all: unset; cursor: pointer; height: 28px; padding: 0 12px; border-radius: 999px; font-weight: 500; white-space: nowrap; }
      .pause { color: #fff; background: rgba(255,255,255,.12); }
      .pause:hover { background: rgba(255,255,255,.2); }
      .stop { background: #fff; color: #18202c; display: inline-flex; align-items: center; gap: 6px; }
      .stop::before { content: ""; width: 9px; height: 9px; border-radius: 2px; background: #d1343e; }
      .stop:hover { background: #e9edf2; }
      .cancel { color: rgba(255,255,255,.7); }
      .cancel:hover { color: #fff; background: rgba(255,255,255,.1); }
      button:focus-visible { outline: 2px solid #5fd0c6; outline-offset: 2px; }
    </style>
    <div class="bar" role="toolbar" aria-label="${t("Bug Stream recording")}">
      <span class="dot" aria-hidden="true"></span>
      <span class="time">0:00</span>
      <span class="state" aria-live="polite"></span>
      <button class="pause" title="${t("Pause (no video is written, the timer stops)")}">${t("Pause")}</button>
      <button class="stop" title="${t("Stop recording and open the report")}">${t("Stop")}</button>
      <button class="cancel" title="${t("Stop without saving")}">${t("Cancel")}</button>
    </div>`;
    ui = {
      bar: root.querySelector(".bar"),
      time: root.querySelector(".time"),
      state: root.querySelector(".state"),
      pause: root.querySelector(".pause")
    };
    ui.pause.addEventListener(
      "click",
      () => chrome.runtime.sendMessage({ type: "bt:pause-request", pause: !!barClock?.runningSince })
    );
    root.querySelector(".stop").addEventListener("click", () => chrome.runtime.sendMessage({ type: "bt:stop-request" }));
    root.querySelector(".cancel").addEventListener("click", () => {
      if (confirm(t("Stop recording without saving?"))) chrome.runtime.sendMessage({ type: "bt:stop-request", cancel: true });
    });
    (document.body ?? document.documentElement).appendChild(recorderHost);
    timer = window.setInterval(tick, 500);
    updateRecorder(clock);
  }
  function tick() {
    if (!ui || !barClock) return;
    ui.time.innerHTML = `${fmt(currentElapsed(barClock))} <small>/ ${fmt(barClock.maxMs)}</small>`;
  }
  function updateRecorder(clock) {
    barClock = clock;
    if (!ui) return;
    const paused = !clock.runningSince;
    ui.bar.classList.toggle("paused", paused);
    ui.state.textContent = paused ? t(PAUSE_TEXT[clock.pauseReason ?? "manual"]) : "";
    ui.pause.textContent = paused ? t("Resume") : t("Pause");
    tick();
  }
  function hideRecorder() {
    clearInterval(timer);
    recorderHost?.remove();
    recorderHost = null;
    ui = null;
    barClock = null;
  }
  var menuHost = null;
  function closeActionMenu() {
    menuHost?.remove();
    menuHost = null;
  }
  async function showActionMenu(recording) {
    if (menuHost) return closeActionMenu();
    const prefs = await getPrefs();
    const replayOn = prefs.instantReplay && !prefs.replayExcluded.includes(location.origin);
    menuHost = document.createElement("adtask-recorder");
    const root = menuHost.attachShadow({ mode: "closed" });
    root.innerHTML = `
    <style>
      :host { all: initial; }
      .backdrop { position: fixed; inset: 0; z-index: 2147483646; background: rgba(24,32,44,.18); }
      .menu { position: fixed; z-index: 2147483647; top: 64px; right: 24px; width: 300px; max-width: calc(100vw - 32px);
        background: #fff; color: #18202c; border: 1px solid #dce1e8; border-radius: 10px; padding: 8px;
        font: 14px/1.4 system-ui, "Segoe UI", sans-serif; box-shadow: 0 16px 40px -12px rgba(24,32,44,.35); }
      h2 { margin: 4px 8px 8px; font-size: 13px; font-weight: 600; color: #5b6676; }
      button { all: unset; box-sizing: border-box; display: flex; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 7px; cursor: pointer; }
      button:hover:not([disabled]) { background: #f3f5f8; }
      button:focus-visible { outline: 2px solid #0d6e6e; outline-offset: -2px; }
      button[disabled] { cursor: default; opacity: .55; }
      .ic { flex: none; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; color: #fff; }
      b { display: block; font-weight: 500; }
      small { display: block; margin-top: 1px; font-size: 12px; color: #8a94a3; }
    </style>
    <div class="backdrop"></div>
    <div class="menu" role="menu" aria-label="Bug Stream">
      <h2>${t("Report a bug")}</h2>
      ${recording ? `<button data-cmd="stop" role="menuitem"><span class="ic" style="background:#d1343e">■</span><span><b>${t("Stop recording")}</b><small>${t("and open the report")}</small></span></button>` : `<button data-cmd="record" role="menuitem"><span class="ic" style="background:#d1343e">●</span><span><b>${t("Record video")}</b><small>${t("Chrome will ask which tab to record — choose this one and press “Share”")}</small></span></button>`}
      <button data-cmd="screenshot" role="menuitem"><span class="ic" style="background:#2b6cb0">▣</span><span><b>${t("Screenshot")}</b><small>${t("with console and network of the last minutes")}</small></span></button>
      <button data-cmd="replay" role="menuitem" ${replayOn ? "" : "disabled"}><span class="ic" style="background:#6b46c1">↺</span><span><b>${t("Last 2 minutes")}</b><small>${replayOn ? t("what happened on the page up to now") : t("turn on instant replay in the extension settings")}</small></span></button>
    </div>`;
    root.querySelector(".backdrop").addEventListener("click", closeActionMenu);
    root.querySelectorAll("button[data-cmd]").forEach(
      (b) => b.addEventListener("click", () => {
        const cmd = b.dataset.cmd;
        closeActionMenu();
        if (cmd === "stop") chrome.runtime.sendMessage({ type: "bt:stop-request" }).catch(() => {
        });
        else pageCommand(cmd);
      })
    );
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeActionMenu();
        document.removeEventListener("keydown", onKey, true);
      }
    };
    document.addEventListener("keydown", onKey, true);
    (document.body ?? document.documentElement).appendChild(menuHost);
    root.querySelector("button:not([disabled])")?.focus();
  }
  function pageCommand(cmd) {
    chrome.runtime.sendMessage({ type: "bt:page-command", cmd }).then((r) => r?.error && showToast(r.error)).catch(() => showToast(t("The Bug Stream extension is unavailable — reload the page")));
  }
  function showToast(text) {
    const host = document.createElement("adtask-recorder");
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>:host{all:initial}div{position:fixed;z-index:2147483647;top:20px;left:50%;transform:translateX(-50%);
    max-width:calc(100vw - 32px);padding:10px 14px;border-radius:8px;background:#18202c;color:#fff;
    font:13px/1.4 system-ui,"Segoe UI",sans-serif;box-shadow:0 10px 30px -8px rgba(0,0,0,.45)}</style><div role="status"></div>`;
    root.querySelector("div").textContent = "Bug Stream: " + text;
    (document.body ?? document.documentElement).appendChild(host);
    setTimeout(() => host.remove(), 5e3);
  }
})();
