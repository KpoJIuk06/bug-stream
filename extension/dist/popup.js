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
  function getLocale() {
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
  function translateDom(root = document) {
    document.documentElement.lang = current;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.dataset.i18n ||= el.textContent?.trim() ?? "";
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.dataset.i18nHtml ||= el.innerHTML.trim();
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.dataset.i18nTitle ||= el.title;
      el.title = t(el.dataset.i18nTitle);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.dataset.i18nPlaceholder ||= el.placeholder;
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
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
  async function login(server, email, password) {
    const res = await fetch(`${server}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: email, password, client: "EXTENSION" })
    });
    if (!res.ok) throw await parseError(res);
    const tokens = await res.json();
    const s = { server, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user };
    await saveSettings(s);
    await saveLocale(tokens.user?.locale);
    return s;
  }
  async function authConfig(server) {
    const res = await fetch(`${server}/api/auth/config`);
    if (!res.ok) throw await parseError(res);
    const c = await res.json();
    if (c.password === void 0) return { password: true, passwordReset: false, ldap: !!c.ldapEnabled, emailCode: false };
    return c;
  }
  async function requestEmailCode(server, email, locale) {
    const res = await fetch(`${server}/api/auth/email-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale })
    });
    if (!res.ok) throw await parseError(res);
  }
  async function loginWithCode(server, email, code) {
    const res = await fetch(`${server}/api/auth/email-code/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, client: "EXTENSION" })
    });
    if (!res.ok) throw await parseError(res);
    const tokens = await res.json();
    const s = { server, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user };
    await saveSettings(s);
    await saveLocale(tokens.user?.locale);
    return s;
  }
  async function logout() {
    const s = await getSettings();
    if (s.refreshToken) {
      await fetch(`${s.server}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: s.refreshToken })
      }).catch(() => {
      });
    }
    await saveSettings({ accessToken: null, refreshToken: null, user: null });
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
  function errorText(e) {
    if (e instanceof ApiError) {
      if (e.code === "BAD_CREDENTIALS") return t("Wrong login or password");
      if (e.code === "USER_DISABLED") return t("Your account is disabled — contact an administrator");
      if (e.code === "NO_ACCESS") return t("You are not in a group that has access to Bug Stream");
      if (e.code === "LDAP_UNAVAILABLE") return t("The corporate directory is not available, try again later");
      if (e.code === "INVALID_CODE") return t("The code is wrong or has expired — request a new one");
      if (e.code === "METHOD_DISABLED") return t("This sign-in method is turned off");
      if (e.code === "TOO_MANY_REQUESTS") return t("Too many attempts — wait a few minutes and try again");
      if (e.code === "INVALID_EMAIL") return t("Enter a valid e-mail address");
      if (e.status === 401) return t("Your session has expired — sign in again");
      if (e.status >= 500 && !e.code?.startsWith("JIRA")) return t("Server error. Try again.");
      return e.message;
    }
    if (e instanceof TypeError) return t("The server is unreachable. Check the address and that you are in the corporate network.");
    return String(e);
  }

  // src/shared/login-form.ts
  function mountLogin(root, defaultServer, onDone) {
    root.innerHTML = `
    <form class="lf-form">
      <label class="field"><span data-k="Server address"></span><input name="server" type="text" placeholder="https://bugs.example.com" required />
        <small data-k="Address of the Bug Stream site in your network"></small></label>
      <div class="lf-tabs hidden" role="tablist">
        <button type="button" data-mode="password" data-k="Password"></button>
        <button type="button" data-mode="code" data-k="E-mail code"></button>
      </div>
      <div class="lf-password">
        <label class="field"><span class="lf-login-label"></span><input name="login" type="text" autocomplete="username" /></label>
        <label class="field"><span data-k="Password"></span><input name="password" type="password" autocomplete="current-password" /></label>
      </div>
      <div class="lf-code hidden">
        <label class="field lf-email"><span data-k="E-mail"></span><input name="email" type="email" autocomplete="email" />
          <small data-k="We will send a one-time code — no password needed."></small></label>
        <p class="lf-sent hidden"></p>
        <label class="field lf-codefield hidden"><span data-k="Code from the e-mail"></span>
          <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" class="lf-codeinput" /></label>
      </div>
      <div class="error-box hidden lf-error" style="margin-bottom: 12px"></div>
      <button class="btn primary block lf-submit" type="submit"></button>
      <p class="lf-links"><button type="button" class="lf-link lf-other hidden" data-k="Another e-mail"></button>
        <button type="button" class="lf-link lf-resend hidden" data-k="Send again"></button></p>
    </form>`;
    root.querySelectorAll("[data-k]").forEach((el) => el.textContent = t(el.dataset.k));
    const q = (sel) => root.querySelector(sel);
    const form = q(".lf-form");
    const server = q('input[name="server"]');
    const loginInput = q('input[name="login"]');
    const password = q('input[name="password"]');
    const email = q('input[name="email"]');
    const code = q('input[name="code"]');
    const submit = q(".lf-submit");
    const errorBox = q(".lf-error");
    const show2 = (el, v) => el.classList.toggle("hidden", !v);
    let cfg = { password: true, passwordReset: false, ldap: false, emailCode: false };
    let mode = "password";
    let sentTo = null;
    const setError = (text) => {
      errorBox.textContent = text ?? "";
      show2(errorBox, !!text);
    };
    const render2 = () => {
      const pwd = cfg.password || cfg.ldap;
      show2(q(".lf-tabs"), pwd && cfg.emailCode);
      root.querySelectorAll(".lf-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
      show2(q(".lf-password"), mode === "password");
      show2(q(".lf-code"), mode === "code");
      loginInput.required = password.required = mode === "password";
      q(".lf-login-label").textContent = cfg.ldap ? t("Work login or e-mail") : t("E-mail");
      email.required = mode === "code" && !sentTo;
      code.required = mode === "code" && !!sentTo;
      show2(q(".lf-email"), !sentTo);
      show2(q(".lf-sent"), !!sentTo);
      show2(q(".lf-codefield"), !!sentTo);
      show2(q(".lf-other"), mode === "code" && !!sentTo);
      show2(q(".lf-resend"), mode === "code" && !!sentTo);
      if (sentTo) q(".lf-sent").textContent = t("If {email} can sign in, a 6-digit code is on its way. It is valid for 10 minutes.", { email: sentTo });
      submit.textContent = mode === "code" && !sentTo ? t("Send code") : t("Sign in");
    };
    const loadConfig = async () => {
      const s = server.value.trim();
      if (!s) return;
      try {
        cfg = await authConfig(normalizeServer(s));
        if (mode === "code" && !cfg.emailCode) mode = "password";
        if (mode === "password" && !cfg.password && !cfg.ldap && cfg.emailCode) mode = "code";
        setError(null);
      } catch {
      }
      render2();
    };
    root.querySelectorAll(".lf-tabs button").forEach(
      (b) => b.addEventListener("click", () => {
        mode = b.dataset.mode;
        setError(null);
        render2();
      })
    );
    q(".lf-other").addEventListener("click", () => {
      sentTo = null;
      code.value = "";
      setError(null);
      render2();
    });
    q(".lf-resend").addEventListener("click", async () => {
      if (!sentTo) return;
      try {
        await requestEmailCode(normalizeServer(server.value), sentTo, getLocale());
        setError(null);
      } catch (err) {
        setError(errorText(err));
      }
    });
    server.addEventListener("change", () => void loadConfig());
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      submit.disabled = true;
      setError(null);
      const label = submit.textContent;
      submit.textContent = mode === "code" && !sentTo ? t("Sending…") : t("Signing in…");
      try {
        const s = normalizeServer(server.value);
        if (mode === "password") {
          await login(s, loginInput.value.trim(), password.value);
          await onDone();
        } else if (!sentTo) {
          await requestEmailCode(s, email.value.trim(), getLocale());
          sentTo = email.value.trim();
          render2();
          code.focus();
        } else {
          await loginWithCode(s, sentTo, code.value.replace(/\s+/g, ""));
          await onDone();
        }
      } catch (err) {
        setError(errorText(err));
        submit.textContent = label;
      } finally {
        submit.disabled = false;
      }
    });
    server.value = defaultServer;
    render2();
    void loadConfig();
    (defaultServer && defaultServer !== "http://localhost" ? loginInput : server).focus();
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
  var listRecordings = () => run(RECORDINGS, "readonly", (t2) => t2.objectStore(RECORDINGS).getAll());

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
  var currentElapsed = (s, now = Date.now()) => s.elapsedMs + (s.runningSince ? now - s.runningSince : 0);
  var REPLAY_WINDOW_MS = 2 * 60 * 1e3;

  // src/shared/prefs.ts
  async function getPrefs() {
    const { prefs } = await chrome.storage.local.get({ prefs: DEFAULT_PREFS });
    return { ...DEFAULT_PREFS, ...prefs };
  }
  async function savePrefs(patch) {
    const next = { ...await getPrefs(), ...patch };
    await chrome.storage.local.set({ prefs: next });
    return next;
  }

  // src/popup.ts
  var $ = (id) => document.getElementById(id);
  var show = (el, visible) => el.classList.toggle("hidden", !visible);
  var fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1e3));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  var timer = 0;
  var state = IDLE_STATE;
  async function showShortcuts() {
    const commands = await chrome.commands.getAll().catch(() => []);
    document.querySelectorAll("[data-cmd]").forEach((el) => {
      const shortcut = commands.find((c) => c.name === el.dataset.cmd)?.shortcut;
      const kbds = el.querySelectorAll("kbd");
      if (!shortcut || !kbds.length) return;
      const first = kbds[0];
      const last = kbds[kbds.length - 1];
      while (first.nextSibling && first.nextSibling !== last) first.nextSibling.remove();
      if (last !== first) last.remove();
      first.textContent = shortcut;
    });
  }
  async function render() {
    translateDom();
    void showShortcuts();
    $("pref-locale").value = getLocale();
    const s = await getSettings();
    const loggedIn = !!s.refreshToken && !!s.user;
    show($("view-login"), !loggedIn);
    show($("view-main"), loggedIn);
    show($("footer"), loggedIn);
    show($("open-site"), loggedIn);
    if (!loggedIn) {
      const root = $("login-root");
      if (!root.firstChild) mountLogin(root, s.server, render);
      return;
    }
    $("login-root").innerHTML = "";
    $("user-name").textContent = s.user.fullName;
    $("server-label").textContent = s.server.replace(/^https?:\/\//, "");
    $("open-site").href = s.server;
    const avatar = $("avatar");
    avatar.textContent = s.user.fullName.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
    let h = 0;
    for (const ch of s.user.fullName) h = (h * 31 + ch.charCodeAt(0)) % 360;
    avatar.style.background = `hsl(${h} 38% 42%)`;
    await Promise.all([renderState(), renderPrefs(), renderUnsaved()]);
    if (state.status === "idle") await chrome.action.setBadgeText({ text: "" });
  }
  async function renderState() {
    const { state: raw } = await chrome.storage.session.get({ state: IDLE_STATE });
    state = { ...IDLE_STATE, ...raw };
    const recording = state.status === "recording" || state.status === "starting";
    const paused = state.status === "recording" && !state.runningSince;
    show($("recording"), recording);
    $("recording").classList.toggle("paused", paused);
    $("rec-label").textContent = paused ? state.pauseReason === "idle" ? t("Paused — no activity") : state.pauseReason === "hidden" ? t("Paused — tab hidden") : t("Paused") : t("Recording");
    $("btn-pause").textContent = paused ? t("Resume") : t("Pause");
    show($("btn-record"), !recording);
    show($("btn-screenshot").parentElement, !recording);
    show($("btn-stop"), recording);
    show($("rec-controls"), recording);
    show($("hint"), !recording);
    clearInterval(timer);
    if (recording) {
      const tick = () => $("rec-time").textContent = `${fmt(currentElapsed(state))} / ${fmt(state.maxMs)}`;
      tick();
      timer = window.setInterval(tick, 500);
    }
    const tab = await activeTab();
    const canRecord = !!tab?.url && /^https?:/.test(tab.url);
    if (!recording) {
      $("btn-record").disabled = !canRecord;
      $("btn-screenshot").disabled = !canRecord;
      showError(canRecord ? null : t("This page cannot be recorded. Open the site where you found the bug."));
    }
    const prefs = await getPrefs();
    const origin = canRecord ? new URL(tab.url).origin : null;
    $("btn-replay").disabled = !canRecord || !prefs.instantReplay || !!origin && prefs.replayExcluded.includes(origin);
  }
  async function renderPrefs() {
    const p = await getPrefs();
    $("pref-max").value = String(p.maxMinutes);
    $("pref-autopause").checked = p.autoPause;
    $("pref-idle").value = String(p.idleSeconds);
    $("pref-idle").disabled = !p.autoPause;
    $("pref-replay").checked = p.instantReplay;
    const tab = await activeTab();
    const origin = tab?.url && /^https?:/.test(tab.url) ? new URL(tab.url).origin : null;
    show($("site-row"), p.instantReplay && !!origin);
    if (origin) {
      $("site-origin").textContent = origin.replace(/^https?:\/\//, "");
      $("pref-site").checked = !p.replayExcluded.includes(origin);
    }
  }
  async function renderUnsaved() {
    const list = (await listRecordings().catch(() => [])).filter((r) => r.status === "done").sort((a, b) => b.createdAt - a.createdAt);
    show($("unsaved"), list.length > 0);
    const ul = $("unsaved-list");
    ul.innerHTML = "";
    const KIND = { video: t("Video"), screenshot: t("Screenshot"), replay: "Replay" };
    for (const r of list.slice(0, 5)) {
      const li = document.createElement("li");
      const label = document.createElement("span");
      const when = new Date(r.createdAt).toLocaleString(intlLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      label.textContent = `${KIND[r.kind]}${r.kind === "screenshot" ? "" : " " + fmt(r.durationMs)} · ${when}`;
      label.title = r.info?.pageUrl ?? "";
      const open2 = document.createElement("button");
      open2.className = "btn";
      open2.textContent = t("Open");
      open2.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL(`preview.html?id=${r.id}`) }).then(() => window.close()));
      li.append(label, open2);
      ul.appendChild(li);
    }
  }
  function showError(text, id = "main-error") {
    const box = $(id);
    box.textContent = text ?? "";
    show(box, !!text);
  }
  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  }
  async function call(msg) {
    const res = await chrome.runtime.sendMessage(msg);
    if (res?.error) throw new Error(res.error);
    return res;
  }
  $("btn-record").addEventListener("click", async () => {
    const tab = await activeTab();
    if (tab?.id == null) return;
    const btn = $("btn-record");
    btn.disabled = true;
    btn.textContent = t("Starting…");
    try {
      await call({ type: "bt:start-request", tabId: tab.id });
      window.close();
    } catch (err) {
      showError(String(err.message));
      btn.disabled = false;
      btn.textContent = t("Record tab");
    }
  });
  $("btn-screenshot").addEventListener("click", async () => {
    const tab = await activeTab();
    if (tab?.id == null) return;
    try {
      await call({ type: "bt:screenshot-request", tabId: tab.id });
      window.close();
    } catch (err) {
      showError(String(err.message));
    }
  });
  $("btn-replay").addEventListener("click", async () => {
    const tab = await activeTab();
    if (tab?.id == null) return;
    try {
      await call({ type: "bt:replay-request", tabId: tab.id });
      window.close();
    } catch (err) {
      showError(String(err.message));
    }
  });
  $("btn-stop").addEventListener("click", async () => {
    try {
      await call({ type: "bt:stop-request" });
      window.close();
    } catch (err) {
      showError(String(err.message));
    }
  });
  $("btn-pause").addEventListener("click", async () => {
    await call({ type: "bt:pause-request", pause: !!state.runningSince }).catch((err) => showError(String(err.message)));
  });
  $("btn-cancel").addEventListener("click", async () => {
    await call({ type: "bt:stop-request", cancel: true }).catch((err) => showError(String(err.message)));
    await renderState();
  });
  $("btn-logout").addEventListener("click", async () => {
    await logout();
    await render();
  });
  var onPref = (id, patch) => $(id).addEventListener("change", async (e) => {
    await savePrefs(await patch(e.target));
    await Promise.all([renderPrefs(), renderState()]);
  });
  onPref("pref-max", (el) => ({ maxMinutes: Number(el.value) }));
  onPref("pref-autopause", (el) => ({ autoPause: el.checked }));
  onPref("pref-idle", (el) => ({ idleSeconds: Number(el.value) }));
  onPref("pref-replay", (el) => ({ instantReplay: el.checked }));
  onPref("pref-site", async (el) => {
    const tab = await activeTab();
    const origin = new URL(tab.url).origin;
    const excluded = (await getPrefs()).replayExcluded.filter((o) => o !== origin);
    return { replayExcluded: el.checked ? excluded : [...excluded, origin] };
  });
  $("pref-locale").addEventListener("change", async (e) => {
    const locale = e.target.value;
    await saveLocale(locale);
    await api("/api/auth/me/locale", { method: "PUT", body: JSON.stringify({ locale }) }).catch(() => {
    });
    await render();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes.state) void renderState();
  });
  void initI18n().then(render);
})();
