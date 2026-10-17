# requirements-sync

Прочитай файл `.claude/commands/requirements-sync.md` і виконай інструкцію з нього повністю (frontmatter пропусти).
Якщо після назви команди є текст — це адреса репо вимог PM (`<owner>/<repo>`, URL або локальний шлях) замість `$ARGUMENTS`.
Команди терміналу (`gh`, `git`, `npm`) запускай по одній; скасування гілки, push і створення PR — лише після явного
«так» людини (кроки 3, 6 і 7.3).

Єдине джерело інструкції — `.claude/commands/requirements-sync.md`; цей файл лише робить команду доступною в Cursor як
`/requirements-sync`.
