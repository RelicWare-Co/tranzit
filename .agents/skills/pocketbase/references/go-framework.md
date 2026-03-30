# PocketBase Go Framework

Rendered and extracted from the PocketBase Go extension guides.

- PocketBase version in source repo: `v0.36.7`
- Generated from site repo: `2026-03-20T19:58:29.364311+00:00`

## Included pages

- `docs/go-overview` -> `src/routes/(app)/docs/go-overview/+page.svelte`
- `docs/go-event-hooks` -> `src/routes/(app)/docs/go-event-hooks/+page.svelte`
- `docs/go-routing` -> `src/routes/(app)/docs/go-routing/+page.svelte`
- `docs/go-database` -> `src/routes/(app)/docs/go-database/+page.svelte`
- `docs/go-records` -> `src/routes/(app)/docs/go-records/+page.svelte`
- `docs/go-collections` -> `src/routes/(app)/docs/go-collections/+page.svelte`
- `docs/go-migrations` -> `src/routes/(app)/docs/go-migrations/+page.svelte`
- `docs/go-jobs-scheduling` -> `src/routes/(app)/docs/go-jobs-scheduling/+page.svelte`
- `docs/go-sending-emails` -> `src/routes/(app)/docs/go-sending-emails/+page.svelte`
- `docs/go-rendering-templates` -> `src/routes/(app)/docs/go-rendering-templates/+page.svelte`
- `docs/go-console-commands` -> `src/routes/(app)/docs/go-console-commands/+page.svelte`
- `docs/go-realtime` -> `src/routes/(app)/docs/go-realtime/+page.svelte`
- `docs/go-filesystem` -> `src/routes/(app)/docs/go-filesystem/+page.svelte`
- `docs/go-logging` -> `src/routes/(app)/docs/go-logging/+page.svelte`
- `docs/go-testing` -> `src/routes/(app)/docs/go-testing/+page.svelte`
- `docs/go-miscellaneous` -> `src/routes/(app)/docs/go-miscellaneous/+page.svelte`
- `docs/go-record-proxy` -> `src/routes/(app)/docs/go-record-proxy/+page.svelte`

## Overview

- Route: `/docs/go-overview`
- Source Svelte: `src/routes/(app)/docs/go-overview/+page.svelte`

### Getting started

 PocketBase can be used as regular Go package that exposes various helpers and hooks to help you implement
    your own custom portable application.

 A new PocketBase instance is created via
    pocketbase.New()
    or
    pocketbase.NewWithConfig(config)
    .

 Once created you can register your custom business logic via the available
    event hooks
    and call
    app.Start()
    to start the application.

 Below is a minimal example:

- Install Go 1.23+
- Create a new project directory with main.go file inside it.

 As a reference, you can also explore the prebuilt executable
                example/base/main.go
                file.

```
package main

import (
    "log"
    "os"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/apis"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // serves static files from the provided public dir (if exists)
        se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

- To init the dependencies, run go mod init myapp && go mod tidy.
- To start the application, run go run . serve.
- To build a statically linked executable, run go build
        and then you can start the created executable with
        ./myapp serve.

### Custom SQLite driver

 The general recommendation is to use the builtin SQLite setup but if you need more
            advanced configuration or extensions like ICU, FTS5, etc. you'll have to specify a custom driver/build.

 Note that PocketBase by default doesn't require CGO because it uses the pure Go SQLite port
            modernc.org/sqlite
            , but this may not be the case when using a custom SQLite driver!

 PocketBase v0.23+ added support for defining a DBConnect function as app configuration to
    load custom SQLite builds and drivers compatible with the standard Go database/sql.

 The DBConnect function is called twice - once for
    pb_data/data.db
    (the main database file) and second time for pb_data/auxiliary.db (used for logs and other ephemeral
    system meta information).

 If you want to load your custom driver conditionally and fallback to the default handler, then you can
    call
    core.DefaultDBConnect
    .

 As a side-note, if you are not planning to use core.DefaultDBConnect
        fallback as part of your custom driver registration you can exclude the default pure Go driver with
        go build -tags no_default_driver to reduce the binary size a little (~4MB).

 Below are some minimal examples with commonly used external SQLite drivers:

### github.com/mattn/go-sqlite3

  This is a CGO driver and requires to build your application with CGO_ENABLED=1.

 For all available options please refer to the
                github.com/mattn/go-sqlite3
                README.

```
package main

import (
    "database/sql"
    "log"

    "github.com/mattn/go-sqlite3"
    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase"
)

// register a new driver with default PRAGMAs and the same query
// builder implementation as the already existing sqlite3 builder
func init() {
    // initialize default PRAGMAs for each new connection
    sql.Register("pb_sqlite3",
        &sqlite3.SQLiteDriver{
            ConnectHook: func(conn *sqlite3.SQLiteConn) error {
                _, err := conn.Exec(`
                    PRAGMA busy_timeout       = 10000;
                    PRAGMA journal_mode       = WAL;
                    PRAGMA journal_size_limit = 200000000;
                    PRAGMA synchronous        = NORMAL;
                    PRAGMA foreign_keys       = ON;
                    PRAGMA temp_store         = MEMORY;
                    PRAGMA cache_size         = -32000;
                `, nil)

                return err
            },
        },
    )

    dbx.BuilderFuncMap["pb_sqlite3"] = dbx.BuilderFuncMap["sqlite3"]
}

func main() {
    app := pocketbase.NewWithConfig(pocketbase.Config{
        DBConnect: func(dbPath string) (*dbx.DB, error) {
            return dbx.Open("pb_sqlite3", dbPath)
        },
    })

    // any custom hooks or plugins...

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### github.com/ncruces/go-sqlite3

  For all available options please refer to the
                github.com/ncruces/go-sqlite3
                README.

```
package main

import (
    "log"

    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase"

    _ "github.com/ncruces/go-sqlite3/driver"
    _ "github.com/ncruces/go-sqlite3/embed"
)

func main() {
    app := pocketbase.NewWithConfig(pocketbase.Config{
        DBConnect: func(dbPath string) (*dbx.DB, error) {
            const pragmas = "?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_pragma=journal_size_limit(200000000)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)&_pragma=temp_store(MEMORY)&_pragma=cache_size(-32000)"

            return dbx.Open("sqlite3", "file:"+dbPath+pragmas)
        },
    })

    // custom hooks and plugins...

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## Event hooks

- Route: `/docs/go-event-hooks`
- Source Svelte: `src/routes/(app)/docs/go-event-hooks/+page.svelte`

The standard way to modify PocketBase is through
    event hooks in your Go code.

 All hooks have 3 main methods:

- Bind(handler)
        adds a new handler to the specified event hook. A handler has 3 fields:

- Id (optional) - the name of the handler (could be used
                as argument for Unbind)
- Priority (optional) - the execution order of the handler
                (if empty fallbacks to the order of registration in the code).
- Func (required) - the handler function.

- BindFunc(func)
        is similar to Bind but registers a new handler from just the provided function.

        The registered handler is added with a default 0 priority and the id is autogenerated (the returned string
        value).
- Trigger(event, oneOffHandlerFuncs...)
        triggers the event hook.

 This method rarely has to be called manually by users.

 To remove an already registered hook handler, you can use the handler id and pass it to
    Unbind(id) or remove all handlers with
    UnbindAll() (!including system handlers).

 All hook handler functions share the same func(e T) error signature and expect
            the user to call e.Next() if they want to proceed with the execution chain.

 If you need to access the app instance from inside a hook handler, prefer using the
            e.App field instead of reusing a parent scope app variable because the hook could be part
            of a DB transaction and can cause deadlock.

 Also avoid using global mutex locks inside a hook handler because it could be invoked recursively
            (e.g. cascade delete) and can cause deadlock.

 You can explore all available hooks below:

### App hooks

### OnBootstrap

                        OnBootstrap hook is triggered when initializing the main
                        application resources (db, app settings, etc).

                    Note that attempting to access the database before the e.Next() call will result in an error.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // e.App

        return nil
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnServe

                    OnServe hook is triggered when the app web server is started
                    (after starting the TCP listener but before initializing the blocking serve task),
                    allowing you to adjust its options and attach new routes or middlewares.

```
package main

import (
    "log"
    "net/http"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/apis"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(e *core.ServeEvent) error {
        // register new "GET /hello" route
        e.Router.GET("/hello", func(e *core.RequestEvent) error {
            return e.String(200, "Hello world!")
        }).Bind(apis.RequireAuth())

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnSettingsReload

                        OnSettingsReload hook is triggered every time when the App.Settings()
                        is being replaced with a new state.

                        Calling e.App.Settings() after e.Next() returns the new state.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnSettingsReload().BindFunc(func(e *core.SettingsReloadEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        // e.App.Settings()

        return nil
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnBackupCreate

                    OnBackupCreate is triggered on each App.CreateBackup call.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnBackupCreate().BindFunc(func(e *core.BackupEvent) error {
        // e.App
        // e.Name    - the name of the backup to create
        // e.Exclude - list of pb_data dir entries to exclude from the backup

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnBackupRestore

                    OnBackupRestore is triggered before app backup restore (aka. on App.RestoreBackup call).

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnBackupRestore().BindFunc(func(e *core.BackupEvent) error {
        // e.App
        // e.Name    - the name of the backup to restore
        // e.Exclude - list of dir entries to exclude from the backup

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnTerminate

                    OnTerminate hook is triggered when the app is in the process
                    of being terminated (ex. on SIGTERM signal).

                    Note that the app could be terminated abruptly without awaiting the hook completion.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnTerminate().BindFunc(func(e *core.TerminateEvent) error {
        // e.App
        // e.IsRestart

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Mailer hooks

### OnMailerSend

                        OnMailerSend hook is triggered every time when a new email is
                        being sent using the App.NewMailClient() instance.

                    It allows intercepting the email message or to use a custom mailer client.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerSend().BindFunc(func(e *core.MailerEvent) error {
        // e.App
        // e.Mailer
        // e.Message

        // ex. change the mail subject
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordAuthAlertSend

                        OnMailerRecordAuthAlertSend hook is triggered when
                        sending a new device login auth alert email, allowing you to
                        intercept and customize the email message that is being sent.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordAuthAlertSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["info"].(string)

        // ex. change the mail subject
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordPasswordResetSend

                        OnMailerRecordPasswordResetSend hook is triggered when
                        sending a password reset email to an auth record, allowing
                        you to intercept and customize the email message that is being sent.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordPasswordResetSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["token"].(string)

        // ex. change the mail subject
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordVerificationSend

                        OnMailerRecordVerificationSend hook is triggered when
                        sending a verification email to an auth record, allowing
                        you to intercept and customize the email message that is being sent.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordVerificationSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["token"].(string)

        // ex. change the mail subject
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordEmailChangeSend

                        OnMailerRecordEmailChangeSend hook is triggered when sending a
                        confirmation new address email to an auth record, allowing
                        you to intercept and customize the email message that is being sent.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordEmailChangeSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["token"].(string)
        // e.Meta["newEmail"].(string)

        // ex. change the mail subject
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnMailerRecordOTPSend

                        OnMailerRecordOTPSend hook is triggered when sending an OTP email
                        to an auth record, allowing you to intercept and customize the
                        email message that is being sent.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordOTPSend().BindFunc(func(e *core.MailerRecordEvent) error {
        // e.App
        // e.Mailer
        // e.Message
        // e.Record
        // e.Meta["otpId"].(string)
        // e.Meta["password"].(string)

        // ex. change the mail subject
        e.Message.Subject = "new subject"

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Realtime hooks

### OnRealtimeConnectRequest

                        OnRealtimeConnectRequest hook is triggered when establishing the SSE client connection.

                        Any execution after e.Next() of a hook handler happens after the client disconnects.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRealtimeConnectRequest().BindFunc(func(e *core.RealtimeConnectRequestEvent) error {
        // e.App
        // e.Client
        // e.IdleTimeout
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRealtimeSubscribeRequest

                    OnRealtimeSubscribeRequest hook is triggered when updating the
                    client subscriptions, allowing you to further validate and
                    modify the submitted change.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRealtimeSubscribeRequest().BindFunc(func(e *core.RealtimeSubscribeRequestEvent) error {
        // e.App
        // e.Client
        // e.Subscriptions
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRealtimeMessageSend

                    OnRealtimeMessageSend hook is triggered when sending an SSE message to a client.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRealtimeMessageSend().BindFunc(func(e *core.RealtimeMessageEvent) error {
        // e.App
        // e.Client
        // e.Message
        // and all original connect RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Record model hooks

                    These are lower level Record model hooks and could be triggered from anywhere (custom console command, scheduled cron job, when calling e.Save(record), etc.) and therefore they have no access to the request context!

                    If you want to intercept the builtin Web APIs and to access their request body, query parameters, headers or the request auth state, then please use the designated
                        Record *Request hooks
                    .

### OnRecordEnrich

                        OnRecordEnrich is triggered every time when a record is enriched
- as part of the builtin Record responses, during realtime message serialization, or when apis.EnrichRecord is invoked.

                        It could be used for example to redact/hide or add computed temporary
                        Record model props only for the specific request info.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnRecordEnrich("posts").BindFunc(func(e *core.RecordEnrichEvent) error {
        // hide one or more fields
        e.Record.Hide("role")

        // add new custom field for registered users
        if e.RequestInfo.Auth != nil && e.RequestInfo.Auth.Collection().Name == "users" {
            e.Record.WithCustomData(true) // for security requires explicitly allowing it
            e.Record.Set("computedScore", e.Record.GetInt("score") * e.RequestInfo.Auth.GetInt("base"))
        }

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordValidate

                        OnRecordValidate is a Record proxy model hook of OnModelValidate.

            OnRecordValidate is called every time when a Record is being validated,
            e.g. triggered by App.Validate() or App.Save().

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordValidate().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordValidate("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Record model create hooks

### OnRecordCreate

                        OnRecordCreate is a Record proxy model hook of OnModelCreate.

            OnRecordCreate is triggered every time when a new Record is being created,
            e.g. triggered by App.Save().

            Operations BEFORE the e.Next() execute before the Record validation
            and the INSERT DB statement.

            Operations AFTER the e.Next() execute after the Record validation
            and the INSERT DB statement.

                Note that successful execution doesn't guarantee that the Record
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnRecordAfterCreateSuccess or OnRecordAfterCreateError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordCreate().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordCreate("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordCreateExecute

                        OnRecordCreateExecute is a Record proxy model hook of OnModelCreateExecute.

            OnRecordCreateExecute is triggered after successful Record validation
            and right before the model INSERT DB statement execution.

            Usually it is triggered as part of the App.Save() in the following firing order:

            OnRecordCreate

             ->
            OnRecordValidate (skipped with App.SaveNoValidate())

             ->
            OnRecordCreateExecute

                Note that successful execution doesn't guarantee that the Record
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnRecordAfterCreateSuccess or OnRecordAfterCreateError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordCreateExecute().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordCreateExecute("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterCreateSuccess

                        OnRecordAfterCreateSuccess is a Record proxy model hook of OnModelAfterCreateSuccess.

            OnRecordAfterCreateSuccess is triggered after each successful
            Record DB create persistence.

                Note that when a Record is persisted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordAfterCreateSuccess().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordAfterCreateSuccess("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterCreateError

                        OnRecordAfterCreateError is a Record proxy model hook of OnModelAfterCreateError.

            OnRecordAfterCreateError is triggered after each failed
            Record DB create persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Save() failure

- delayed on transaction rollback

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordAfterCreateError().BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordAfterCreateError("users", "articles").BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Record model update hooks

### OnRecordUpdate

                        OnRecordUpdate is a Record proxy model hook of OnModelUpdate.

            OnRecordUpdate is triggered every time when a new Record is being updated,
            e.g. triggered by App.Save().

            Operations BEFORE the e.Next() execute before the Record validation
            and the UPDATE DB statement.

            Operations AFTER the e.Next() execute after the Record validation
            and the UPDATE DB statement.

                Note that successful execution doesn't guarantee that the Record
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnRecordAfterUpdateSuccess or OnRecordAfterUpdateError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordUpdate().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordUpdate("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordUpdateExecute

                        OnRecordUpdateExecute is a Record proxy model hook of OnModelUpdateExecute.

            OnRecordUpdateExecute is triggered after successful Record validation
            and right before the model UPDATE DB statement execution.

            Usually it is triggered as part of the App.Save() in the following firing order:

            OnRecordUpdate

             ->
            OnRecordValidate (skipped with App.SaveNoValidate())

             ->
            OnRecordUpdateExecute

                Note that successful execution doesn't guarantee that the Record
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnRecordAfterUpdateSuccess or OnRecordAfterUpdateError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordUpdateExecute().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordUpdateExecute("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterUpdateSuccess

                        OnRecordAfterUpdateSuccess is a Record proxy model hook of OnModelAfterUpdateSuccess.

            OnRecordAfterUpdateSuccess is triggered after each successful
            Record DB update persistence.

                Note that when a Record is persisted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordAfterUpdateSuccess().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordAfterUpdateSuccess("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterUpdateError

                        OnRecordAfterUpdateError is a Record proxy model hook of OnModelAfterUpdateError.

            OnRecordAfterUpdateError is triggered after each failed
            Record DB update persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Save() failure

- delayed on transaction rollback

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordAfterUpdateError().BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordAfterUpdateError("users", "articles").BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Record model delete hooks

### OnRecordDelete

                        OnRecordDelete is a Record proxy model hook of OnModelDelete.

            OnRecordDelete is triggered every time when a new Record is being deleted,
            e.g. triggered by App.Delete().

            Operations BEFORE the e.Next() execute before the Record validation
            and the UPDATE DB statement.

            Operations AFTER the e.Next() execute after the Record validation
            and the UPDATE DB statement.

                Note that successful execution doesn't guarantee that the Record
                is deleted from the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted deleted events, you can
                bind to OnRecordAfterDeleteSuccess or OnRecordAfterDeleteError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordDelete().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordDelete("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordDeleteExecute

                        OnRecordDeleteExecute is a Record proxy model hook of OnModelDeleteExecute.

            OnRecordDeleteExecute is triggered after the internal delete checks and
            right before the Record the model DELETE DB statement execution.

            Usually it is triggered as part of the App.Delete() in the following firing order:

            OnRecordDelete

             ->
            internal delete checks

             ->
            OnRecordDeleteExecute

                Note that successful execution doesn't guarantee that the Record
                is deleted from the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnRecordAfterDeleteSuccess or OnRecordAfterDeleteError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordDeleteExecute().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordDeleteExecute("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterDeleteSuccess

                        OnRecordAfterDeleteSuccess is a Record proxy model hook of OnModelAfterDeleteSuccess.

            OnRecordAfterDeleteSuccess is triggered after each successful
            Record DB delete persistence.

                Note that when a Record is deleted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordAfterDeleteSuccess("users", "articles").BindFunc(func(e *core.RecordEvent) error {
        // e.App
        // e.Record

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAfterDeleteError

                        OnRecordAfterDeleteError is a Record proxy model hook of OnModelAfterDeleteError.

            OnRecordAfterDeleteError is triggered after each failed
            Record DB delete persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Delete() failure

- delayed on transaction rollback

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every record
    app.OnRecordAfterDeleteError().BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" records
    app.OnRecordAfterDeleteError("users", "articles").BindFunc(func(e *core.RecordErrorEvent) error {
        // e.App
        // e.Record
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Collection model hooks

                    These are lower level Collection model hooks and could be triggered from anywhere (custom console command, scheduled cron job, when calling e.Save(collection), etc.) and therefore they have no access to the request context!

                    If you want to intercept the builtin Web APIs and to access their request body, query parameters, headers or the request auth state, then please use the designated
                        Collection *Request hooks
                    .

### OnCollectionValidate

                        OnCollectionValidate is a Collection proxy model hook of OnModelValidate.

            OnCollectionValidate is called every time when a Collection is being validated,
            e.g. triggered by App.Validate() or App.Save().

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionValidate().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionValidate("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Collection mode create hooks

### OnCollectionCreate

                        OnCollectionCreate is a Collection proxy model hook of OnModelCreate.

            OnCollectionCreate is triggered every time when a new Collection is being created,
            e.g. triggered by App.Save().

            Operations BEFORE the e.Next() execute before the Collection validation
            and the INSERT DB statement.

            Operations AFTER the e.Next() execute after the Collection validation
            and the INSERT DB statement.

                Note that successful execution doesn't guarantee that the Collection
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnCollectionAfterCreateSuccess or OnCollectionAfterCreateError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionCreate().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionCreate("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionCreateExecute

                        OnCollectionCreateExecute is a Collection proxy model hook of OnModelCreateExecute.

            OnCollectionCreateExecute is triggered after successful Collection validation
            and right before the model INSERT DB statement execution.

            Usually it is triggered as part of the App.Save() in the following firing order:

            OnCollectionCreate

             ->
            OnCollectionValidate (skipped with App.SaveNoValidate())

             ->
            OnCollectionCreateExecute

                Note that successful execution doesn't guarantee that the Collection
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnCollectionAfterCreateSuccess or OnCollectionAfterCreateError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionCreateExecute().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionCreateExecute("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterCreateSuccess

                        OnCollectionAfterCreateSuccess is a Collection proxy model hook of OnModelAfterCreateSuccess.

            OnCollectionAfterCreateSuccess is triggered after each successful
            Collection DB create persistence.

                Note that when a Collection is persisted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionAfterCreateSuccess().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionAfterCreateSuccess("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterCreateError

                        OnCollectionAfterCreateError is a Collection proxy model hook of OnModelAfterCreateError.

            OnCollectionAfterCreateError is triggered after each failed
            Collection DB create persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Save() failure

- delayed on transaction rollback

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionAfterCreateError().BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionAfterCreateError("users", "articles").BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Collection mode update hooks

### OnCollectionUpdate

                        OnCollectionUpdate is a Collection proxy model hook of OnModelUpdate.

            OnCollectionUpdate is triggered every time when a new Collection is being updated,
            e.g. triggered by App.Save().

            Operations BEFORE the e.Next() execute before the Collection validation
            and the UPDATE DB statement.

            Operations AFTER the e.Next() execute after the Collection validation
            and the UPDATE DB statement.

                Note that successful execution doesn't guarantee that the Collection
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnCollectionAfterUpdateSuccess or OnCollectionAfterUpdateError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionUpdate().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionUpdate("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionUpdateExecute

                        OnCollectionUpdateExecute is a Collection proxy model hook of OnModelUpdateExecute.

            OnCollectionUpdateExecute is triggered after successful Collection validation
            and right before the model UPDATE DB statement execution.

            Usually it is triggered as part of the App.Save() in the following firing order:

            OnCollectionUpdate

             ->
            OnCollectionValidate (skipped with App.SaveNoValidate())

             ->
            OnCollectionUpdateExecute

                Note that successful execution doesn't guarantee that the Collection
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnCollectionAfterUpdateSuccess or OnCollectionAfterUpdateError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionUpdateExecute().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionUpdateExecute("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterUpdateSuccess

                        OnCollectionAfterUpdateSuccess is a Collection proxy model hook of OnModelAfterUpdateSuccess.

            OnCollectionAfterUpdateSuccess is triggered after each successful
            Collection DB update persistence.

                Note that when a Collection is persisted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionAfterUpdateSuccess().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionAfterUpdateSuccess("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterUpdateError

                        OnCollectionAfterUpdateError is a Collection proxy model hook of OnModelAfterUpdateError.

            OnCollectionAfterUpdateError is triggered after each failed
            Collection DB update persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Save() failure

- delayed on transaction rollback

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionAfterUpdateError().BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionAfterUpdateError("users", "articles").BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Collection mode delete hooks

### OnCollectionDelete

                        OnCollectionDelete is a Collection proxy model hook of OnModelDelete.

            OnCollectionDelete is triggered every time when a new Collection is being deleted,
            e.g. triggered by App.Delete().

            Operations BEFORE the e.Next() execute before the Collection validation
            and the UPDATE DB statement.

            Operations AFTER the e.Next() execute after the Collection validation
            and the UPDATE DB statement.

                Note that successful execution doesn't guarantee that the Collection
                is deleted from the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted deleted events, you can
                bind to OnCollectionAfterDeleteSuccess or OnCollectionAfterDeleteError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionDelete().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionDelete("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionDeleteExecute

                        OnCollectionDeleteExecute is a Collection proxy model hook of OnModelDeleteExecute.

            OnCollectionDeleteExecute is triggered after the internal delete checks and
            right before the Collection the model DELETE DB statement execution.

            Usually it is triggered as part of the App.Delete() in the following firing order:

            OnCollectionDelete

             ->
            internal delete checks

             ->
            OnCollectionDeleteExecute

                Note that successful execution doesn't guarantee that the Collection
                is deleted from the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnCollectionAfterDeleteSuccess or OnCollectionAfterDeleteError hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionDeleteExecute().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionDeleteExecute("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterDeleteSuccess

                        OnCollectionAfterDeleteSuccess is a Collection proxy model hook of OnModelAfterDeleteSuccess.

            OnCollectionAfterDeleteSuccess is triggered after each successful
            Collection DB delete persistence.

                Note that when a Collection is deleted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionAfterDeleteSuccess().BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionAfterDeleteSuccess("users", "articles").BindFunc(func(e *core.CollectionEvent) error {
        // e.App
        // e.Collection

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionAfterDeleteError

                        OnCollectionAfterDeleteError is a Collection proxy model hook of OnModelAfterDeleteError.

            OnCollectionAfterDeleteError is triggered after each failed
            Collection DB delete persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Delete() failure

- delayed on transaction rollback

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnCollectionAfterDeleteError().BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnCollectionAfterDeleteError("users", "articles").BindFunc(func(e *core.CollectionErrorEvent) error {
        // e.App
        // e.Collection
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Request hooks

                    The request hooks are triggered only when the corresponding API request endpoint is accessed.

###### Record CRUD request hooks

### OnRecordsListRequest

                        OnRecordsListRequest hook is triggered on each API Records list request.
                        Could be used to validate or modify the response before returning it to the client.

        Note that if you want to hide existing or add new computed Record fields prefer using the
        OnRecordEnrich
        hook because it is less error-prone and it is triggered
        by all builtin Record responses (including when sending realtime Record events).

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnRecordsListRequest().BindFunc(func(e *core.RecordsListRequestEvent) error {
        // e.App
        // e.Collection
        // e.Records
        // e.Result
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnRecordsListRequest("users", "articles").BindFunc(func(e *core.RecordsListRequestEvent) error {
        // e.App
        // e.Collection
        // e.Records
        // e.Result
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordViewRequest

                        OnRecordViewRequest hook is triggered on each API Record view request.
                        Could be used to validate or modify the response before returning it to the client.

        Note that if you want to hide existing or add new computed Record fields prefer using the
        OnRecordEnrich
        hook because it is less error-prone and it is triggered
        by all builtin Record responses (including when sending realtime Record events).

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnRecordViewRequest().BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnRecordViewRequest("users", "articles").BindFunc(func(e *core.RecordRequestEvent) error {
        log.Println(e.HttpContext)
        log.Println(e.Record)
        return nil
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordCreateRequest

                        OnRecordCreateRequest hook is triggered on each API Record create request.

                        Could be used to additionally validate the request data or implement
                        completely different persistence behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnRecordCreateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnRecordCreateRequest("users", "articles").BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordUpdateRequest

                        OnRecordUpdateRequest hook is triggered on each API Record update request.

                        Could be used to additionally validate the request data or implement
                        completely different persistence behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnRecordUpdateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnRecordUpdateRequest("users", "articles").BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordDeleteRequest

                        OnRecordDeleteRequest hook is triggered on each API Record delete request.

                        Could be used to additionally validate the request data or implement
                        completely different delete behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every collection
    app.OnRecordDeleteRequest().BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "articles" collections
    app.OnRecordDeleteRequest("users", "articles").BindFunc(func(e *core.RecordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Record auth request hooks

### OnRecordAuthRequest

                        OnRecordAuthRequest hook is triggered on each successful API
                        record authentication request (sign-in, token refresh, etc.).
                        Could be used to additionally validate or modify the authenticated
                        record data and token.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordAuthRequest().BindFunc(func(e *core.RecordAuthRequestEvent) error {
        // e.App
        // e.Record
        // e.Token
        // e.Meta
        // e.AuthMethod
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordAuthRequest("users", "managers").BindFunc(func(e *core.RecordAuthRequestEvent) error {
        // e.App
        // e.Record
        // e.Token
        // e.Meta
        // e.AuthMethod
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAuthRefreshRequest

                        OnRecordAuthRefreshRequest hook is triggered on each Record
                        auth refresh API request (right before generating a new auth token).

                        Could be used to additionally validate the request data or implement
                        completely different auth refresh behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordAuthRefreshRequest().BindFunc(func(e *core.RecordAuthWithOAuth2RequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordAuthRefreshRequest("users", "managers").BindFunc(func(e *core.RecordAuthWithOAuth2RequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAuthWithPasswordRequest

                        OnRecordAuthWithPasswordRequest hook is triggered on each
                        Record auth with password API request.

                        e.Record could be nil if no matching identity is found, allowing
                        you to manually locate a different Record model (by reassigning e.Record).

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordAuthWithPasswordRequest().BindFunc(func(e *core.RecordAuthWithPasswordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record (could be nil)
        // e.Identity
        // e.IdentityField
        // e.Password
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordAuthWithPasswordRequest("users", "managers").BindFunc(func(e *core.RecordAuthWithPasswordRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record (could be nil)
        // e.Identity
        // e.IdentityField
        // e.Password
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAuthWithOAuth2Request

                        OnRecordAuthWithOAuth2Request hook is triggered on each Record
                        OAuth2 sign-in/sign-up API request (after token exchange and before external provider linking).

                        If e.Record is not set, then the OAuth2
                        request will try to create a new auth record.

                        To assign or link a different existing record model you can
                        change the e.Record field.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordAuthWithOAuth2Request().BindFunc(func(e *core.RecordAuthWithOAuth2RequestEvent) error {
        // e.App
        // e.Collection
        // e.ProviderName
        // e.ProviderClient
        // e.Record (could be nil)
        // e.OAuth2User
        // e.CreateData
        // e.IsNewRecord
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordAuthWithOAuth2Request("users", "managers").BindFunc(func(e *core.RecordAuthWithOAuth2RequestEvent) error {
        // e.App
        // e.Collection
        // e.ProviderName
        // e.ProviderClient
        // e.Record (could be nil)
        // e.OAuth2User
        // e.CreateData
        // e.IsNewRecord
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordRequestPasswordResetRequest

                        OnRecordRequestPasswordResetRequest hook is triggered on
                        each Record request password reset API request.

                        Could be used to additionally validate the request data or implement
                        completely different password reset behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordRequestPasswordResetRequest().BindFunc(func(e *core.RecordRequestPasswordResetRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordRequestPasswordResetRequest("users", "managers").BindFunc(func(e *core.RecordRequestPasswordResetRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordConfirmPasswordResetRequest

                        OnRecordConfirmPasswordResetRequest hook is triggered on
                        each Record confirm password reset API request.

                        Could be used to additionally validate the request data or implement
                        completely different persistence behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordConfirmPasswordResetRequest().BindFunc(func(e *core.RecordConfirmPasswordResetRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordConfirmPasswordResetRequest("users", "managers").BindFunc(func(e *core.RecordConfirmPasswordResetRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordRequestVerificationRequest

                        OnRecordRequestVerificationRequest hook is triggered on
                        each Record request verification API request.

                        Could be used to additionally validate the loaded request data or implement
                        completely different verification behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordRequestVerificationRequest().BindFunc(func(e *core.RecordRequestVerificationRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordRequestVerificationRequest("users", "managers").BindFunc(func(e *core.RecordRequestVerificationRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordConfirmVerificationRequest

                        OnRecordConfirmVerificationRequest hook is triggered on each
                        Record confirm verification API request.

                        Could be used to additionally validate the request data or implement
                        completely different persistence behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordConfirmVerificationRequest().BindFunc(func(e *core.RecordConfirmVerificationRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordConfirmVerificationRequest("users", "managers").BindFunc(func(e *core.RecordConfirmVerificationRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordRequestEmailChangeRequest

                        OnRecordRequestEmailChangeRequest hook is triggered on each
                        Record request email change API request.

                        Could be used to additionally validate the request data or implement
                        completely different request email change behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordRequestEmailChangeRequest().BindFunc(func(e *core.RecordRequestEmailChangeRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.NewEmail
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordRequestEmailChangeRequest("users", "managers").BindFunc(func(e *core.RecordRequestEmailChangeRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.NewEmail
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordConfirmEmailChangeRequest

                        OnRecordConfirmEmailChangeRequest hook is triggered on each
                        Record confirm email change API request.

                       Could be used to additionally validate the request data or implement
                       completely different persistence behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordConfirmEmailChangeRequest().BindFunc(func(e *core.RecordConfirmEmailChangeRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.NewEmail
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordConfirmEmailChangeRequest("users", "managers").BindFunc(func(e *core.RecordConfirmEmailChangeRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.NewEmail
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordRequestOTPRequest

                        OnRecordRequestOTPRequest hook is triggered on each Record
                        request OTP API request.

                        e.Record could be nil if no user with the requested email is found, allowing
                        you to manually create a new Record or locate a different Record model (by reassigning e.Record).

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordRequestOTPRequest().BindFunc(func(e *core.RecordCreateOTPRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record (could be nil)
        // e.Password
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordRequestOTPRequest("users", "managers").BindFunc(func(e *core.RecordCreateOTPRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record (could be nil)
        // e.Password
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnRecordAuthWithOTPRequest

                        OnRecordAuthWithOTPRequest hook is triggered on each Record
                        auth with OTP API request.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth collection
    app.OnRecordAuthWithOTPRequest().BindFunc(func(e *core.RecordAuthWithOTPRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.OTP
        // and all RequestEvent fields...

        return e.Next()
    })

    // fires only for "users" and "managers" auth collections
    app.OnRecordAuthWithOTPRequest("users", "managers").BindFunc(func(e *core.RecordAuthWithOTPRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.OTP
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Batch request hooks

### OnBatchRequest

                    OnBatchRequest hook is triggered on each API batch request.

                    Could be used to additionally validate or modify the submitted batch requests.

                    This hook will also fire the corresponding OnRecordCreateRequest, OnRecordUpdateRequest, OnRecordDeleteRequest hooks, where e.App is the batch transactional app.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnBatchRequest().BindFunc(func(e *core.BatchRequestEvent) error {
        // e.App
        // e.Batch
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### File request hooks

### OnFileDownloadRequest

                    OnFileDownloadRequest hook is triggered before each API File download request.
                    Could be used to validate or modify the file response before returning it to the client.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnFileDownloadRequest().BindFunc(func(e *core.FileDownloadRequestEvent) error {
        // e.App
        // e.Collection
        // e.Record
        // e.FileField
        // e.ServedPath
        // e.ServedName
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnFileTokenRequest

                        OnFileTokenRequest hook is triggered on each auth file token API request.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every auth model
    app.OnFileTokenRequest().BindFunc(func(e *core.FileTokenRequestEvent) error {
        // e.App
        // e.Record
        // e.Token
        // and all RequestEvent fields...

        return e.Next();
    })

    // fires only for "users"
    app.OnFileTokenRequest("users").BindFunc(func(e *core.FileTokenRequestEvent) error {
        // e.App
        // e.Record
        // e.Token
        // and all RequestEvent fields...

        return e.Next();
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Collection request hooks

### OnCollectionsListRequest

                    OnCollectionsListRequest hook is triggered on each API Collections list request.
                    Could be used to validate or modify the response before returning it to the client.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionsListRequest().BindFunc(func(e *core.CollectionsListRequestEvent) error {
        // e.App
        // e.Collections
        // e.Result
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionViewRequest

                    OnCollectionViewRequest hook is triggered on each API Collection view request.
                    Could be used to validate or modify the response before returning it to the client.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionViewRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
        // e.App
        // e.Collection
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionCreateRequest

                    OnCollectionCreateRequest hook is triggered on each API Collection create request.

                    Could be used to additionally validate the request data or implement
                    completely different persistence behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionCreateRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
        // e.App
        // e.Collection
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionUpdateRequest

                    OnCollectionUpdateRequest hook is triggered on each API Collection update request.

                    Could be used to additionally validate the request data or implement
                    completely different persistence behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionUpdateRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
        // e.App
        // e.Collection
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionDeleteRequest

                    OnCollectionDeleteRequest hook is triggered on each API Collection delete request.

                    Could be used to additionally validate the request data or implement
                    completely different delete behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionDeleteRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
        // e.App
        // e.Collection
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnCollectionsImportRequest

                    OnCollectionsImportRequest hook is triggered on each API
                    collections import request.

                    Could be used to additionally validate the imported collections or
                    to implement completely different import behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnCollectionsImportRequest().BindFunc(func(e *core.CollectionsImportRequestEvent) error {
        // e.App
        // e.CollectionsData
        // e.DeleteMissing

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Settings request hooks

### OnSettingsListRequest

                    OnSettingsListRequest hook is triggered on each API Settings list request.

                    Could be used to validate or modify the response before returning it to the client.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnSettingsListRequest().BindFunc(func(e *core.SettingsListRequestEvent) error {
        // e.App
        // e.Settings
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnSettingsUpdateRequest

                    OnSettingsUpdateRequest hook is triggered on each API Settings update request.

                    Could be used to additionally validate the request data or
                    implement completely different persistence behavior.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnSettingsUpdateRequest().BindFunc(func(e *core.SettingsUpdateRequestEvent) error {
        // e.App
        // e.OldSettings
        // e.NewSettings
        // and all RequestEvent fields...

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Base model hooks

                    The Model hooks are fired for all PocketBase structs that implements the Model DB interface - Record, Collection, Log, etc.

                        For convenience, if you want to listen to only the Record or Collection DB model
                        events without doing manual type assertion, you can use the
                        OnRecord*
                        and
                        OnCollection*
                        proxy hooks above.

### OnModelValidate

            OnModelValidate is called every time when a Model is being validated,
            e.g. triggered by App.Validate() or App.Save().

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelValidate().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelValidate("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Base model create hooks

### OnModelCreate

            OnModelCreate is triggered every time when a new Model is being created,
            e.g. triggered by App.Save().

            Operations BEFORE the e.Next() execute before the Model validation
            and the INSERT DB statement.

            Operations AFTER the e.Next() execute after the Model validation
            and the INSERT DB statement.

                Note that successful execution doesn't guarantee that the Model
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnModelAfterCreateSuccess or OnModelAfterCreateError hooks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelCreate().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelCreate("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelCreateExecute

            OnModelCreateExecute is triggered after successful Model validation
            and right before the model INSERT DB statement execution.

            Usually it is triggered as part of the App.Save() in the following firing order:

            OnModelCreate

             ->
            OnModelValidate (skipped with App.SaveNoValidate())

             ->
            OnModelCreateExecute

                Note that successful execution doesn't guarantee that the Model
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnModelAfterCreateSuccess or OnModelAfterCreateError hooks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelCreateExecute().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelCreateExecute("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterCreateSuccess

            OnModelAfterCreateSuccess is triggered after each successful
            Model DB create persistence.

                Note that when a Model is persisted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelAfterCreateSuccess().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelAfterCreateSuccess("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterCreateError

            OnModelAfterCreateError is triggered after each failed
            Model DB create persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Save() failure

- delayed on transaction rollback

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelAfterCreateError().BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelAfterCreateError("users", "articles").BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Base model update hooks

### OnModelUpdate

            OnModelUpdate is triggered every time when a new Model is being updated,
            e.g. triggered by App.Save().

            Operations BEFORE the e.Next() execute before the Model validation
            and the UPDATE DB statement.

            Operations AFTER the e.Next() execute after the Model validation
            and the UPDATE DB statement.

                Note that successful execution doesn't guarantee that the Model
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnModelAfterUpdateSuccess or OnModelAfterUpdateError hooks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelUpdate().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelUpdate("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelUpdateExecute

            OnModelUpdateExecute is triggered after successful Model validation
            and right before the model UPDATE DB statement execution.

            Usually it is triggered as part of the App.Save() in the following firing order:

            OnModelUpdate

             ->
            OnModelValidate (skipped with App.SaveNoValidate())

             ->
            OnModelUpdateExecute

                Note that successful execution doesn't guarantee that the Model
                is persisted in the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnModelAfterUpdateSuccess or OnModelAfterUpdateError hooks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelUpdateExecute().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelUpdateExecute("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterUpdateSuccess

            OnModelAfterUpdateSuccess is triggered after each successful
            Model DB update persistence.

                Note that when a Model is persisted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelAfterUpdateSuccess().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelAfterUpdateSuccess("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterUpdateError

            OnModelAfterUpdateError is triggered after each failed
            Model DB update persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Save() failure

- delayed on transaction rollback

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelAfterUpdateError().BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelAfterUpdateError("users", "articles").BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

###### Base model delete hooks

### OnModelDelete

            OnModelDelete is triggered every time when a new Model is being deleted,
            e.g. triggered by App.Delete().

            Operations BEFORE the e.Next() execute before the Model validation
            and the UPDATE DB statement.

            Operations AFTER the e.Next() execute after the Model validation
            and the UPDATE DB statement.

                Note that successful execution doesn't guarantee that the Model
                is deleted from the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted deleted events, you can
                bind to OnModelAfterDeleteSuccess or OnModelAfterDeleteError hooks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelDelete().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelDelete("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelDeleteExecute

            OnModelDeleteExecute is triggered after the internal delete checks and
            right before the Model the model DELETE DB statement execution.

            Usually it is triggered as part of the App.Delete() in the following firing order:

            OnModelDelete

             ->
            internal delete checks

             ->
            OnModelDeleteExecute

                Note that successful execution doesn't guarantee that the Model
                is deleted from the database since its wrapping transaction may
                not have been committed yet.
                If you want to listen to only the actual persisted events, you can
                bind to OnModelAfterDeleteSuccess or OnModelAfterDeleteError hooks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelDeleteExecute().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelDeleteExecute("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterDeleteSuccess

            OnModelAfterDeleteSuccess is triggered after each successful
            Model DB delete persistence.

                Note that when a Model is deleted as part of a transaction,
                this hook is delayed and executed only AFTER the transaction has been committed.
                This hook is NOT triggered in case the transaction fails/rollbacks.

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelAfterDeleteSuccess().BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelAfterDeleteSuccess("users", "articles").BindFunc(func(e *core.ModelEvent) error {
        // e.App
        // e.Model

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### OnModelAfterDeleteError

            OnModelAfterDeleteError is triggered after each failed
            Model DB delete persistence.

                Note that the execution of this hook is either immediate or delayed
                depending on the error:

- immediate on App.Delete() failure

- delayed on transaction rollback

            For convenience, if you want to listen to only the Record or Collection models
            events without doing manual type assertion, you can use the equivalent OnRecord* and OnCollection* proxy hooks.

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    // fires for every model
    app.OnModelAfterDeleteError().BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    // fires only for "users" and "articles" models
    app.OnModelAfterDeleteError("users", "articles").BindFunc(func(e *core.ModelErrorEvent) error {
        // e.App
        // e.Model
        // e.Error

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## Routing

- Route: `/docs/go-routing`
- Source Svelte: `src/routes/(app)/docs/go-routing/+page.svelte`

PocketBase routing is built on top of the standard Go
     net/http.ServeMux.
    The router can be accessed via the app.OnServe() hook allowing you to register custom endpoints
    and middlewares.

### Routes

##### Registering new routes

 Every route has a path, handler function and eventually middlewares attached to it. For example:

```
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // register "GET /hello/{name}" route (allowed for everyone)
    se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
        name := e.Request.PathValue("name")

        return e.String(http.StatusOK, "Hello " + name)
    })

    // register "POST /api/myapp/settings" route (allowed only for authenticated users)
    se.Router.POST("/api/myapp/settings", func(e *core.RequestEvent) error {
        // do something ...
        return e.JSON(http.StatusOK, map[string]bool{"success": true})
    }).Bind(apis.RequireAuth())

    return se.Next()
})
```

 There are several routes registration methods available, but the most common ones are:

```
se.Router.GET(path, action)
se.Router.POST(path, action)
se.Router.PUT(path, action)
se.Router.PATCH(path, action)
se.Router.DELETE(path, action)

// If you want to handle any HTTP method define only a path (e.g. "/example")
// OR if you want to specify a custom one add it as prefix to the path (e.g. "TRACE /example")
se.Router.Any(pattern, action)
```

 The router also supports creating groups for routes that share the same base path and middlewares. For
    example:

```
g := se.Router.Group("/api/myapp")

// group middleware
g.Bind(apis.RequireAuth())

// group routes
g.GET("", action1)
g.GET("/example/{id}", action2)
g.PATCH("/example/{id}", action3).BindFunc(
    /* custom route specific middleware func */
)

// nested group
sub := g.Group("/sub")
sub.GET("/sub1", action4)
```

 The example registers the following endpoints

            (all require authenticated user access):

- GET /api/myapp -> action1
- GET /api/myapp/example/{id} -> action2
- PATCH /api/myapp/example/{id} -> action3
- GET /api/myapp/example/sub/sub1 -> action4

 Each router group and route could define middlewares in a similar manner to the
    regular app hooks via the Bind/BindFunc methods, allowing you to perform various BEFORE or AFTER
    action operations (e.g. inspecting request headers, custom access checks, etc.).

##### Path parameters and matching rules

 Because PocketBase routing is based on top of the Go standard router mux, we follow the same pattern
    matching rules. Below you could find a short overview but for more details please refer to
     net/http.ServeMux.

 In general, a route pattern looks like [METHOD ][HOST]/[PATH]
    (the METHOD prefix is added automatically when using the designated GET(),
        POST(), etc. methods)).

 Route paths can include parameters in the format {paramName}.

    You can also use {paramName...} format to specify a parameter that targets more than one path
    segment.

 A pattern ending with a trailing slash / acts as anonymous wildcard and matches any requests
    that begins with the defined route. If you want to have a trailing slash but to indicate the end of the
    URL then you need to end the path with the special
    {$} parameter.

 If your route path starts with /api/
            consider combining it with your unique app name like /api/myapp/... to avoid collisions
            with system routes.

 Here are some examples:

```
// match "GET example.com/index.html"
se.Router.GET("example.com/index.html")

// match "GET /index.html" (for any host)
se.Router.GET("/index.html")

// match "GET /static/", "GET /static/a/b/c", etc.
se.Router.GET("/static/")

// match "GET /static/", "GET /static/a/b/c", etc.
// (similar to the above but with a named wildcard parameter)
se.Router.GET("/static/{path...}")

// match only "GET /static/" (if no "/static" is registered, it is 301 redirected)
se.Router.GET("/static/{$}")

// match "GET /customers/john", "GET /customers/jane", etc.
se.Router.GET("/customers/{name}")
```

  In the following examples e is usually
        *core.RequestEvent value.

##### Reading path parameters

```
id := e.Request.PathValue("id")
```

##### Retrieving the current auth state

 The request auth state can be accessed (or set) via the RequestEvent.Auth field.

```
authRecord := e.Auth

isGuest := e.Auth == nil

// the same as "e.Auth != nil && e.Auth.IsSuperuser()"
isSuperuser := e.HasSuperuserAuth()
```

 Alternatively you could also access the request data from the summarized request info instance
    (usually used in hooks like the OnRecordEnrich where there is no direct access to the request)
    .

```
info, err := e.RequestInfo()

authRecord := info.Auth

isGuest := info.Auth == nil

// the same as "info.Auth != nil && info.Auth.IsSuperuser()"
isSuperuser := info.HasSuperuserAuth()
```

##### Reading query parameters

```
// retrieve the first value of the "search" query param
search := e.Request.URL.Query().Get("search")

// or via the parsed request info
info, err := e.RequestInfo()
search := info.Query["search"]

// in case of array query params (e.g. search=123&search=456)
arr := e.Request.URL.Query()["search"] // []string{"123", "456"}
```

##### Reading request headers

```
token := e.Request.Header.Get("Some-Header")

// or via the parsed request info
// (the header value is always normalized per the @request.headers.* API rules format)
info, err := e.RequestInfo()
token := info.Headers["some_header"]
```

##### Writing response headers

```
e.Response.Header().Set("Some-Header", "123")
```

##### Retrieving uploaded files

```
// retrieve the uploaded files and parse the found multipart data into a ready-to-use []*filesystem.File
files, err := e.FindUploadedFiles("document")

// or retrieve the raw single multipart/form-data file and header
mf, mh, err := e.Request.FormFile("document")
```

##### Reading request body

 Body parameters can be read either via
    e.BindBody
    OR through the parsed request info (requires manual type assertions).

 The e.BindBody argument must be a pointer to a struct or map[string]any.

    The following struct tags are supported
    (the specific binding rules and which one will be used depend on the request Content-Type):

- json (json body)- uses the builtin Go JSON package for unmarshaling.
- xml (xml body) - uses the builtin Go XML package for unmarshaling.
- form (form data) - utilizes the custom
        router.UnmarshalRequestData
        method.

 NB! When binding structs make sure that they don't have public fields that shouldn't be bindable and it is
    advisable such fields to be unexported or define a separate struct with just the safe bindable fields.

```
// read/scan the request body fields into a typed struct
data := struct {
    // unexported to prevent binding
    somethingPrivate string

    Title       string `json:"title" form:"title"`
    Description string `json:"description" form:"description"`
    Active      bool   `json:"active" form:"active"`
}{}
if err := e.BindBody(&data); err != nil {
    return e.BadRequestError("Failed to read request data", err)
}

// alternatively, read the body via the parsed request info
info, err := e.RequestInfo()
title, ok := info.Body["title"].(string)
```

##### Writing response body

 For all supported methods, you can refer to
        router.Event
        .

```
// send response with JSON body
// (it also provides a generic response fields picker/filter if the "fields" query parameter is set)
e.JSON(http.StatusOK, map[string]any{"name": "John"})

// send response with string body
e.String(http.StatusOK, "Lorem ipsum...")

// send response with HTML body
// (check also the "Rendering templates" section)
e.HTML(http.StatusOK, "

# Hello!

")

// redirect
e.Redirect(http.StatusTemporaryRedirect, "https://example.com")

// send response with no body
e.NoContent(http.StatusNoContent)

// serve a single file
e.FileFS(os.DirFS("..."), "example.txt")

// stream the specified reader
e.Stream(http.StatusOK, "application/octet-stream", reader)

// send response with blob (bytes slice) body
e.Blob(http.StatusOK, "application/octet-stream", []byte{ ... })
```

##### Reading the client IP

```
// The IP of the last client connecting to your server.
// The returned IP is safe and can be always trusted.
// When behind a reverse proxy (e.g. nginx) this method returns the IP of the proxy.
// https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/router#Event.RemoteIP
ip := e.RemoteIP()

// The "real" IP of the client based on the configured Settings.TrustedProxy header(s).
// If such headers are not set, it fallbacks to e.RemoteIP().
// https://pkg.go.dev/github.com/pocketbase/pocketbase/core#RequestEvent.RealIP
ip := e.RealIP()
```

##### Request store

 The core.RequestEvent comes with a local store that you can use to share custom data between
    middlewares and the route action.

```
// store for the duration of the request
e.Set("someKey", 123)

// retrieve later
val := e.Get("someKey").(int) // 123
```

### Middlewares

##### Registering middlewares

 Middlewares allow inspecting, intercepting and filtering route requests.

 All middleware functions share the same signature with the route actions (aka.
    func(e *core.RequestEvent) error) but expect the user to call e.Next() if they
    want to proceed with the execution chain.

 Middlewares can be registered globally, on group and on route level using the
    Bind
    and BindFunc methods.

 Here is a minimal example of what a global middleware looks like:

```
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // register a global middleware
    se.Router.BindFunc(func(e *core.RequestEvent) error {
        if e.Request.Header.Get("Something") == "" {
            return e.BadRequestError("Something header value is missing!", nil)
        }
        return e.Next()
    })

    return se.Next()
})
```

 RouterGroup.Bind(middlewares...)
    /
    Route.Bind(middlewares...)
    registers one or more middleware handlers.

    Similar to the other app hooks, a middleware handler has 3 fields:

- Id (optional) - the name of the middleware (could be used as argument for
        Unbind)
- Priority (optional) - the execution order of the middleware (if empty fallbacks to
        the order of registration in the code)
- Func (required) - the middleware handler function

 Often you don't need to specify the Id or Priority of the middleware and for
    convenience you can instead use directly
    RouterGroup.BindFunc(funcs...)
    /
    Route.BindFunc(funcs...) .

 Below is a slightly more advanced example showing all options and the execution sequence (2,0,1,3,4):

```
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // attach global middleware
    se.Router.BindFunc(func(e *core.RequestEvent) error {
        println(0)
        return e.Next()
    })

    g := se.Router.Group("/sub")

    // attach group middleware
    g.BindFunc(func(e *core.RequestEvent) error {
        println(1)
        return e.Next()
    })

    // attach group middleware with an id and custom priority
    g.Bind(&hook.Handler[*core.RequestEvent]{
        Id: "something",
        Func: func(e *core.RequestEvent) error {
            println(2)
            return e.Next()
        },
        Priority: -1,
    })

    // attach middleware to a single route
    //
    // "GET /sub/hello" should print the sequence: 2,0,1,3,4
    g.GET("/hello", func(e *core.RequestEvent) error {
        println(4)
        return e.String(200, "Hello!")
    }).BindFunc(func(e *core.RequestEvent) error {
        println(3)
        return e.Next()
    })

    return se.Next()
})
```

##### Removing middlewares

 To remove a registered middleware from the execution chain for a specific group or route you can make use
    of the
    Unbind(id) method.

 Note that only middlewares that have a non-empty Id can be removed.

```
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // global middleware
    se.Router.Bind(&hook.Handler[*core.RequestEvent]{
        Id: "test",
        Func: func(e *core.RequestEvent) error {
            // ...
            return e.Next()
        },
    )

    // "GET /A" invokes the "test" middleware
    se.Router.GET("/A", func(e *core.RequestEvent) error {
        return e.String(200, "A")
    })

    // "GET /B" doesn't invoke the "test" middleware
    se.Router.GET("/B", func(e *core.RequestEvent) error {
        return e.String(200, "B")
    }).Unbind("test")

    return se.Next()
})
```

##### Builtin middlewares

 The
    apis
    package exposes several middlewares that you can use as part of your application.

```
// Require the request client to be unauthenticated (aka. guest).
// Example: Route.Bind(apis.RequireGuestOnly())
apis.RequireGuestOnly()

// Require the request client to be authenticated
// (optionally specify a list of allowed auth collection names, default to any).
// Example: Route.Bind(apis.RequireAuth())
apis.RequireAuth(optCollectionNames...)

// Require the request client to be authenticated as superuser
// (this is an alias for apis.RequireAuth(core.CollectionNameSuperusers)).
// Example: Route.Bind(apis.RequireSuperuserAuth())
apis.RequireSuperuserAuth()

// Require the request client to be authenticated as superuser OR
// regular auth record with id matching the specified route parameter (default to "id").
// Example: Route.Bind(apis.RequireSuperuserOrOwnerAuth(""))
apis.RequireSuperuserOrOwnerAuth(ownerIdParam)

// Changes the global 32MB default request body size limit (set it to 0 for no limit).
// Note that system record routes have dynamic body size limit based on their collection field types.
// Example: Route.Bind(apis.BodyLimit(10 The below list is mostly useful for users that may want to plug their own custom middlewares before/after
    the priority of the default global ones, for example: registering a custom auth loader before the rate
    limiter with apis.DefaultRateLimitMiddlewarePriority - 1 so that the rate limit can be applied
    properly based on the loaded auth state. All PocketBase applications have the below internal middlewares registered out of the box (sorted by their priority):

- WWW redirect apis.DefaultWWWRedirectMiddlewareId apis.DefaultWWWRedirectMiddlewarePriority
 Performs www -> non-www redirect(s) if the request host matches with one of the values in
            certificate host policy.
- CORS apis.DefaultCorsMiddlewareId apis.DefaultCorsMiddlewarePriority
 By default all origins are allowed (PocketBase is stateless and doesn't rely on cookies) and can
            be configured with the --origins
            flag but for more advanced customization it can be also replaced entirely by binding with
            apis.CORS(config) middleware or registering your own custom one in its place.
- Activity logger apis.DefaultActivityLoggerMiddlewareId apis.DefaultActivityLoggerMiddlewarePriority
 Saves request information into the logs auxiliary database.
- Auto panic recover apis.DefaultPanicRecoverMiddlewareId apis.DefaultPanicRecoverMiddlewarePriority
 Default panic-recover handler.
- Auth token loader apis.DefaultLoadAuthTokenMiddlewareId apis.DefaultLoadAuthTokenMiddlewarePriority
 Loads the auth token from the Authorization header and populates the related auth
            record into the request event (aka. e.Auth).
- Security response headers apis.DefaultSecurityHeadersMiddlewareId apis.DefaultSecurityHeadersMiddlewarePriority
 Adds default common security headers (X-XSS-Protection,
            X-Content-Type-Options,
            X-Frame-Options) to the response (can be overwritten by other middlewares or from
            inside the route action).
- Rate limit apis.DefaultRateLimitMiddlewareId apis.DefaultRateLimitMiddlewarePriority
 Rate limits client requests based on the configured app settings (it does nothing if the rate
            limit option is not enabled).
- Body limit apis.DefaultBodyLimitMiddlewareId apis.DefaultBodyLimitMiddlewarePriority
 Applies a default max ~32MB request body limit for all custom routes ( system record routes have
            dynamic body size limit based on their collection field types). Can be overwritten on group/route
            level by simply rebinding the apis.BodyLimit(limitBytes) middleware.

### Error response

 PocketBase has a global error handler and every returned error from a route or middleware will be safely
    converted by default to a generic ApiError to avoid accidentally leaking sensitive
    information (the original raw error message will be visible only in the Dashboard > Logs or when
    in --dev mode).

 To make it easier returning formatted JSON error responses, the request event provides several
    ApiError methods.

    Note that ApiError.RawData() will be returned in the response only if it is a map of
    router.SafeErrorItem/validation.Error items.

```
import validation "github.com/go-ozzo/ozzo-validation/v4"

se.Router.GET("/example", func(e *core.RequestEvent) error {
    ...

    // construct ApiError with custom status code and validation data error
    return e.Error(500, "something went wrong", map[string]validation.Error{
        "title": validation.NewError("invalid_title", "Invalid or missing title"),
    })

    // if message is empty string, a default one will be set
    return e.BadRequestError(optMessage, optData)      // 400 ApiError
    return e.UnauthorizedError(optMessage, optData)    // 401 ApiError
    return e.ForbiddenError(optMessage, optData)       // 403 ApiError
    return e.NotFoundError(optMessage, optData)        // 404 ApiError
    return e.TooManyRequestsError(optMessage, optData) // 429 ApiError
    return e.InternalServerError(optMessage, optData)  // 500 ApiError
})
```

 This is not very common but if you want to return ApiError outside of request related
    handlers, you can use the below
    apis.* factories:

```
import (
    validation "github.com/go-ozzo/ozzo-validation/v4"
    "github.com/pocketbase/pocketbase/apis"
)

app.OnRecordCreate().BindFunc(func(e *core.RecordEvent) error {
    ...

    // construct ApiError with custom status code and validation data error
    return apis.NewApiError(500, "something went wrong", map[string]validation.Error{
        "title": validation.NewError("invalid_title", "Invalid or missing title"),
    })

    // if message is empty string, a default one will be set
    return apis.NewBadRequestError(optMessage, optData)      // 400 ApiError
    return apis.NewUnauthorizedError(optMessage, optData)    // 401 ApiError
    return apis.NewForbiddenError(optMessage, optData)       // 403 ApiError
    return apis.NewNotFoundError(optMessage, optData)        // 404 ApiError
    return apis.NewTooManyRequestsError(optMessage, optData) // 429 ApiError
    return apis.NewInternalServerError(optMessage, optData)  // 500 ApiError
})
```

### Helpers

##### Serving static directory

 apis.Static()
    serves static directory content from fs.FS instance.

 Expects the route to have a {path...} wildcard parameter.

```
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    // serves static files from the provided dir (if exists)
    se.Router.GET("/{path...}", apis.Static(os.DirFS("/path/to/public"), false))

    return se.Next()
})
```

##### Auth response

 apis.RecordAuthResponse()

    writes standardized JSON record auth response (aka. token + record data) into the specified request body.
    Could be used as a return result from a custom auth route.

```
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.POST("/phone-login", func(e *core.RequestEvent) error {
        data := struct {
            Phone    string `json:"phone" form:"phone"`
            Password string `json:"password" form:"password"`
        }{}
        if err := e.BindBody(&data); err != nil {
            return e.BadRequestError("Failed to read request data", err)
        }

        record, err := e.App.FindFirstRecordByData("users", "phone", data.Phone)
        if err != nil || !record.ValidatePassword(data.Password) {
            // return generic 400 error as a basic enumeration protection
            return e.BadRequestError("Invalid credentials", err)
        }

        return apis.RecordAuthResponse(e, record, "phone", nil)
    })

    return se.Next()
})
```

##### Enrich record(s)

 apis.EnrichRecord()
    and
    apis.EnrichRecords()
    helpers parses the request context and enrich the provided record(s) by:

- expands relations (if defaultExpands and/or ?expand query parameter is set)
- ensures that the emails of the auth record and its expanded auth relations are visible only for the
        current logged superuser, record owner or record with manage access

```
app.OnServe().BindFunc(func(se *core.ServeEvent) error {
    se.Router.GET("/custom-article", func(e *core.RequestEvent) error {
        records, err := e.App.FindRecordsByFilter("article", "status = 'active'", "-created", 40, 0)
        if err != nil {
            return e.NotFoundError("No active articles", err)
        }

        // enrich the records with the "categories" relation as default expand
        err = apis.EnrichRecords(e, records, "categories")
        if err != nil {
            return err
        }

        return e.JSON(http.StatusOK, records)
    })

    return se.Next()
})
```

##### Go http.Handler wrappers

 If you want to register standard Go http.Handler function and middlewares, you can use
    apis.WrapStdHandler(handler)
    and
    apis.WrapStdMiddleware(func)
    functions.

### Sending request to custom routes using the SDKs

 The official PocketBase SDKs expose the internal send() method that could be used to send requests
    to your custom route(s).

 JavaScript

 Dart

```
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

await pb.send("/hello", {
    // for other options check
    // https://developer.mozilla.org/en-US/docs/Web/API/fetch#options
    query: { "abc": 123 },
});
```

```
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

await pb.send("/hello", query: { "abc": 123 })
```

## Database

- Route: `/docs/go-database`
- Source Svelte: `src/routes/(app)/docs/go-database/+page.svelte`

core.App
    is the main interface to interact with the database.

 App.DB() returns a dbx.Builder that can run all kinds of SQL statements, including
    raw queries.

 Most of the common DB operations are listed below, but you can find further information in the
    dbx package godoc
    .

 For more details and examples how to interact with Record and Collection models programmatically
            you could also check Collection operations
            and
            Record operations sections.

### Executing queries

 To execute DB queries you can start with the NewQuery("...") statement and then call one of:

-  Execute()
- for any query statement that is not meant to retrieve data:

```
res, err := app.DB().
    NewQuery("DELETE FROM articles WHERE status = 'archived'").
    Execute()
```

-  One()
- to populate a single row into a struct:

```
type User struct {
    Id     string                  `db:"id" json:"id"`
    Status bool                    `db:"status" json:"status"`
    Age    int                     `db:"age" json:"age"`
    Roles  types.JSONArray[string] `db:"roles" json:"roles"`
}

user := User{}

err := app.DB().
    NewQuery("SELECT id, status, age, roles FROM users WHERE id=1").
    One(&user)
```

-  All()
- to populate multiple rows into a slice of structs:

```
type User struct {
    Id     string                  `db:"id" json:"id"`
    Status bool                    `db:"status" json:"status"`
    Age    int                     `db:"age" json:"age"`
    Roles  types.JSONArray[string] `db:"roles" json:"roles"`
}

users := []User{}

err := app.DB().
    NewQuery("SELECT id, status, age, roles FROM users LIMIT 100").
    All(&users)
```

### Binding parameters

 To prevent SQL injection attacks, you should use named parameters for any expression value that comes from
    user input. This could be done using the named {:paramName}
    placeholders in your SQL statement and then define the parameter values for the query with
    Bind(params). For example:

```
type Post struct {
    Name     string         `db:"name" json:"name"`
    Created  types.DateTime `db:"created" json:"created"`
}

posts := []Post{}

err := app.DB().
    NewQuery("SELECT name, created FROM posts WHERE created >= {:from} and created Instead of writing plain SQLs, you can also compose SQL statements programmatically using the db query
    builder.

    Every SQL keyword has a corresponding query building method. For example, SELECT corresponds
    to Select(), FROM corresponds to From(),
    WHERE corresponds to Where(), and so on.

```
users := []struct {
    Id    string `db:"id" json:"id"`
    Email string `db:"email" json:"email"`
}{}

app.DB().
    Select("id", "email").
    From("users").
    AndWhere(dbx.Like("email", "example.com")).
    Limit(100).
    OrderBy("created ASC").
    All(&users)
```

##### Select(), AndSelect(), Distinct()

 The Select(...cols) method initializes a SELECT query builder. It accepts a list
    of the column names to be selected.

    To add additional columns to an existing select query, you can call AndSelect().

    To select distinct rows, you can call Distinct(true).

```
app.DB().
    Select("id", "avatar as image").
    AndSelect("(firstName || ' ' || lastName) as fullName").
    Distinct(true)
    ...
```

##### From()

 The From(...tables) method specifies which tables to select from (plain table names are automatically
    quoted).

```
app.DB().
    Select("table1.id", "table2.name").
    From("table1", "table2")
    ...
```

##### Join()

 The Join(type, table, on) method specifies a JOIN clause. It takes 3 parameters:

- type - join type string like INNER JOIN, LEFT JOIN, etc.
- table - the name of the table to be joined
- on - optional dbx.Expression as an ON clause

 For convenience, you can also use the shortcuts InnerJoin(table, on),
    LeftJoin(table, on),
    RightJoin(table, on) to specify INNER JOIN, LEFT JOIN and
    RIGHT JOIN, respectively.

```
app.DB().
    Select("users.*").
    From("users").
    InnerJoin("profiles", dbx.NewExp("profiles.user_id = users.id")).
    Join("FULL OUTER JOIN", "department", dbx.NewExp("department.id = {:id}", dbx.Params{ "id": "someId" }))
    ...
```

##### Where(), AndWhere(), OrWhere()

 The Where(exp) method specifies the WHERE condition of the query.

    You can also use AndWhere(exp) or OrWhere(exp) to append additional one or more
    conditions to an existing WHERE clause.

    Each where condition accepts a single dbx.Expression (see below for full list).

```
/*
SELECT users.*
FROM users
WHERE id = "someId" AND
    status = "public" AND
    name like "%john%" OR
    (
        role = "manager" AND
        fullTime IS TRUE AND
        experience > 10
    )
*/
app.DB().
    Select("users.*").
    From("users").
    Where(dbx.NewExp("id = {:id}", dbx.Params{ "id": "someId" })).
    AndWhere(dbx.HashExp{"status": "public"}).
    AndWhere(dbx.Like("name", "john")).
    OrWhere(dbx.And(
        dbx.HashExp{
            "role":     "manager",
            "fullTime": true,
        },
        dbx.NewExp("experience > {:exp}", dbx.Params{ "exp": 10 })
    ))
    ...
```

 The following dbx.Expression methods are available:

-  dbx.NewExp(raw, optParams)

        Generates an expression with the specified raw query fragment. Use the optParams to bind
        dbx.Params to the expression.

```
dbx.NewExp("status = 'public'")
dbx.NewExp("total > {:min} AND total  dbx.HashExp{k:v}

        Generates a hash expression from a map whose keys are DB column names which need to be filtered according
        to the corresponding values.

```
// slug = "example" AND active IS TRUE AND tags in ("tag1", "tag2", "tag3") AND parent IS NULL
dbx.HashExp{
    "slug":   "example",
    "active": true,
    "tags":   []any{"tag1", "tag2", "tag3"},
    "parent": nil,
}
```

-  dbx.Not(exp)

        Negates a single expression by wrapping it with NOT().

```
// NOT(status = 1)
dbx.Not(dbx.NewExp("status = 1"))
```

-  dbx.And(...exps)

        Creates a new expression by concatenating the specified ones with AND.

```
// (status = 1 AND username like "%john%")
dbx.And(
    dbx.NewExp("status = 1"),
    dbx.Like("username", "john"),
)
```

-  dbx.Or(...exps)

        Creates a new expression by concatenating the specified ones with OR.

```
// (status = 1 OR username like "%john%")
dbx.Or(
    dbx.NewExp("status = 1"),
    dbx.Like("username", "john")
)
```

-  dbx.In(col, ...values)

        Generates an IN expression for the specified column and the list of allowed values.

```
// status IN ("public", "reviewed")
dbx.In("status", "public", "reviewed")
```

-  dbx.NotIn(col, ...values)

        Generates an NOT IN expression for the specified column and the list of allowed values.

```
// status NOT IN ("public", "reviewed")
dbx.NotIn("status", "public", "reviewed")
```

-  dbx.Like(col, ...values)

        Generates a LIKE expression for the specified column and the possible strings that the
        column should be like. If multiple values are present, the column should be like
        all of them.

        By default, each value will be surrounded by "%" to enable partial matching. Special
        characters like "%", "\", "_" will also be properly escaped. You may call
        Escape(...pairs) and/or Match(left, right) to change the default behavior.

```
// name LIKE "%test1%" AND name LIKE "%test2%"
dbx.Like("name", "test1", "test2")

// name LIKE "test1%"
dbx.Like("name", "test1").Match(false, true)
```

-  dbx.NotLike(col, ...values)

        Generates a NOT LIKE expression in similar manner as Like().

```
// name NOT LIKE "%test1%" AND name NOT LIKE "%test2%"
dbx.NotLike("name", "test1", "test2")

// name NOT LIKE "test1%"
dbx.NotLike("name", "test1").Match(false, true)
```

-  dbx.OrLike(col, ...values)

        This is similar to Like() except that the column must be one of the provided values, aka.
        multiple values are concatenated with OR instead of AND.

```
// name LIKE "%test1%" OR name LIKE "%test2%"
dbx.OrLike("name", "test1", "test2")

// name LIKE "test1%" OR name LIKE "test2%"
dbx.OrLike("name", "test1", "test2").Match(false, true)
```

-  dbx.OrNotLike(col, ...values)

        This is similar to NotLike() except that the column must not be one of the provided
        values, aka. multiple values are concatenated with OR instead of AND.

```
// name NOT LIKE "%test1%" OR name NOT LIKE "%test2%"
dbx.OrNotLike("name", "test1", "test2")

// name NOT LIKE "test1%" OR name NOT LIKE "test2%"
dbx.OrNotLike("name", "test1", "test2").Match(false, true)
```

-  dbx.Exists(exp)

        Prefix with EXISTS the specified expression (usually a subquery).

```
// EXISTS (SELECT 1 FROM users WHERE status = 'active')
dbx.Exists(dbx.NewExp("SELECT 1 FROM users WHERE status = 'active'"))
```

-  dbx.NotExists(exp)

        Prefix with NOT EXISTS the specified expression (usually a subquery).

```
// NOT EXISTS (SELECT 1 FROM users WHERE status = 'active')
dbx.NotExists(dbx.NewExp("SELECT 1 FROM users WHERE status = 'active'"))
```

-  dbx.Between(col, from, to)

        Generates a BETWEEN expression with the specified range.

```
// age BETWEEN 3 and 99
dbx.Between("age", 3, 99)
```

-  dbx.NotBetween(col, from, to)

        Generates a NOT BETWEEN expression with the specified range.

```
// age NOT BETWEEN 3 and 99
dbx.NotBetween("age", 3, 99)
```

##### OrderBy(), AndOrderBy()

 The OrderBy(...cols) specifies the ORDER BY clause of the query.

    A column name can contain "ASC" or "DESC" to indicate its ordering direction.

    You can also use AndOrderBy(...cols) to append additional columns to an existing
    ORDER BY clause.

```
app.DB().
    Select("users.*").
    From("users").
    OrderBy("created ASC", "updated DESC").
    AndOrderBy("title ASC")
    ...
```

##### GroupBy(), AndGroupBy()

 The GroupBy(...cols) specifies the GROUP BY clause of the query.

    You can also use AndGroupBy(...cols) to append additional columns to an existing
    GROUP BY clause.

```
app.DB().
    Select("users.*").
    From("users").
    GroupBy("department", "level")
    ...
```

##### Having(), AndHaving(), OrHaving()

 The Having(exp) specifies the HAVING clause of the query.

    Similarly to
    Where(exp), it accept a single dbx.Expression (see all available expressions
    listed above).

    You can also use AndHaving(exp) or OrHaving(exp) to append additional one or
    more conditions to an existing HAVING clause.

```
app.DB().
    Select("users.*").
    From("users").
    GroupBy("department", "level").
    Having(dbx.NewExp("sum(level) > {:sum}", dbx.Params{ sum: 10 }))
    ...
```

##### Limit()

 The Limit(number) method specifies the LIMIT clause of the query.

```
app.DB().
    Select("users.*").
    From("users").
    Limit(30)
    ...
```

##### Offset()

 The Offset(number) method specifies the OFFSET clause of the query. Usually used
    together with Limit(number).

```
app.DB().
    Select("users.*").
    From("users").
    Offset(5).
    Limit(30)
    ...
```

### Transaction

 To execute multiple queries in a transaction you can use
    app.RunInTransaction(fn)
    .

 The DB operations are persisted only if the transaction returns nil.

 It is safe to nest RunInTransaction calls as long as you use the callback's
    txApp argument.

 Inside the transaction function always use its txApp argument and not the original
            app instance because we allow only a single writer/transaction at a time and it could
            result in a deadlock.

 To avoid performance issues, try to minimize slow/long running tasks such as sending emails,
            connecting to external services, etc. as part of the transaction.

```
err := app.RunInTransaction(func(txApp core.App) error {
    // update a record
    record, err := txApp.FindRecordById("articles", "RECORD_ID")
    if err != nil {
        return err
    }
    record.Set("status", "active")
    if err := txApp.Save(record); err != nil {
        return err
    }

    // run a custom raw query (doesn't fire event hooks)
    rawQuery := "DELETE FROM articles WHERE status = 'pending'"
    if _, err := txApp.DB().NewQuery(rawQuery).Execute(); err != nil {
        return err
    }

    return nil
})
```

## Record operations

- Route: `/docs/go-records`
- Source Svelte: `src/routes/(app)/docs/go-records/+page.svelte`

The most common task when using PocketBase as framework probably would be querying and working with your
    collection records.

 You could find detailed documentation about all the supported Record model methods in
    core.Record
    but below are some examples with the most common ones.

### Set field value

```
// sets the value of a single record field
// (field type specific modifiers are also supported)
record.Set("title", "example")
record.Set("users+", "6jyr1y02438et52") // append to existing value

// populates a record from a data map
// (calls Set for each entry of the map)
record.Load(data)
```

### Get field value

```
// retrieve a single record field value
// (field specific modifiers are also supported)
record.Get("someField")            // -> any (without cast)
record.GetBool("someField")        // -> cast to bool
record.GetString("someField")      // -> cast to string
record.GetInt("someField")         // -> cast to int
record.GetFloat("someField")       // -> cast to float64
record.GetDateTime("someField")    // -> cast to types.DateTime
record.GetStringSlice("someField") // -> cast to []string

// retrieve the new uploaded files
// (e.g. for inspecting and modifying the file(s) before save)
record.GetUnsavedFiles("someFileField")

// unmarshal a single "json" field value into the provided result
record.UnmarshalJSONField("someJSONField", &result)

// retrieve a single or multiple expanded data
record.ExpandedOne("author")     // -> nil|*core.Record
record.ExpandedAll("categories") // -> []*core.Record

// export all the public safe record fields as map[string]any
// (note: "json" type field values are exported as types.JSONRaw bytes slice)
record.PublicExport()
```

### Auth accessors

```
record.IsSuperuser() // alias for record.Collection().Name == "_superusers"

record.Email()         // alias for record.Get("email")
record.SetEmail(email) // alias for record.Set("email", email)

record.Verified()         // alias for record.Get("verified")
record.SetVerified(false) // alias for record.Set("verified", false)

record.TokenKey()        // alias for record.Get("tokenKey")
record.SetTokenKey(key)  // alias for record.Set("tokenKey", key)
record.RefreshTokenKey() // alias for record.Set("tokenKey:autogenerate", "")

record.ValidatePassword(pass)
record.SetPassword(pass)   // alias for record.Set("password", pass)
record.SetRandomPassword() // sets cryptographically random 30 characters string as password
```

### Copies

```
// returns a shallow copy of the current record model populated
// with its ORIGINAL db data state and everything else reset to the defaults
// (usually used for comparing old and new field values)
record.Original()

// returns a shallow copy of the current record model populated
// with its LATEST data state and everything else reset to the defaults
// (aka. no expand, no custom fields and with default visibility flags)
record.Fresh()

// returns a shallow copy of the current record model populated
// with its ALL collection and custom fields data, expand and visibility flags
record.Clone()
```

### Hide/Unhide fields

 Collection fields can be marked as "Hidden" from the Dashboard to prevent regular user access to the field
    values.

 Record models provide an option to further control the fields serialization visibility in addition to the
    "Hidden" fields option using the
    record.Hide(fieldNames...)
    and
    record.Unhide(fieldNames...)
    methods.

 Often the Hide/Unhide methods are used in combination with the OnRecordEnrich hook
    invoked on every record enriching (list, view, create, update, realtime change, etc.). For example:

```
app.OnRecordEnrich("articles").BindFunc(func(e *core.RecordEnrichEvent) error {
    // dynamically show/hide a record field depending on whether the current
    // authenticated user has a certain "role" (or any other field constraint)
    if e.RequestInfo.Auth == nil ||
        (!e.RequestInfo.Auth.IsSuperuser() && e.RequestInfo.Auth.GetString("role") != "staff") {
        e.Record.Hide("someStaffOnlyField")
    }

    return e.Next()
})
```

 For custom fields, not part of the record collection schema, it is required to call explicitly
            record.WithCustomData(true) to allow them in the public serialization.

### Fetch records

##### Fetch single record

 All single record retrieval methods return nil and sql.ErrNoRows error if no record
    is found.

```
// retrieve a single "articles" record by its id
record, err := app.FindRecordById("articles", "RECORD_ID")

// retrieve a single "articles" record by a single key-value pair
record, err := app.FindFirstRecordByData("articles", "slug", "test")

// retrieve a single "articles" record by a string filter expression
// (NB! use "{:placeholder}" to safely bind untrusted user input parameters)
record, err := app.FindFirstRecordByFilter(
    "articles",
    "status = 'public' && category = {:category}",
    dbx.Params{ "category": "news" },
)
```

##### Fetch multiple records

 All multiple records retrieval methods return empty slice and nil error if no records are found.

```
// retrieve multiple "articles" records by their ids
records, err := app.FindRecordsByIds("articles", []string{"RECORD_ID1", "RECORD_ID2"})

// retrieve the total number of "articles" records in a collection with optional dbx expressions
totalPending, err := app.CountRecords("articles", dbx.HashExp{"status": "pending"})

// retrieve multiple "articles" records with optional dbx expressions
records, err := app.FindAllRecords("articles",
    dbx.NewExp("LOWER(username) = {:username}", dbx.Params{"username": "John.Doe"}),
    dbx.HashExp{"status": "pending"},
)

// retrieve multiple paginated "articles" records by a string filter expression
// (NB! use "{:placeholder}" to safely bind untrusted user input parameters)
records, err := app.FindRecordsByFilter(
    "articles",                                    // collection
    "status = 'public' && category = {:category}", // filter
    "-published",                                   // sort
    10,                                            // limit
    0,                                             // offset
    dbx.Params{ "category": "news" },              // optional filter params
)
```

##### Fetch auth records

```
// retrieve a single auth record by its email
user, err := app.FindAuthRecordByEmail("users", "test@example.com")

// retrieve a single auth record by JWT
// (you could also specify an optional list of accepted token types)
user, err := app.FindAuthRecordByToken("YOUR_TOKEN", core.TokenTypeAuth)
```

##### Custom record query

 In addition to the above query helpers, you can also create custom Record queries using
    RecordQuery(collection)
    method. It returns a SELECT DB builder that can be used with the same methods described in the
    Database guide.

```
import (
    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase/core"
)

...

func FindActiveArticles(app core.App) ([]*core.Record, error) {
    records := []*core.Record{}

    err := app.RecordQuery("articles").
        AndWhere(dbx.HashExp{"status": "active"}).
        OrderBy("published DESC").
        Limit(10).
        All(&records)

    if err != nil {
        return nil, err
    }

    return records, nil
}
```

### Create new record

##### Create new record programmatically

```
import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/filesystem"
)

...

collection, err := app.FindCollectionByNameOrId("articles")
if err != nil {
    return err
}

record := core.NewRecord(collection)

record.Set("title", "Lorem ipsum")
record.Set("active", true)

// field type specific modifiers can also be used
record.Set("slug:autogenerate", "post-")

// new files must be one or a slice of *filesystem.File values
//
// note1: see all factories in https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#File
// note2: for reading files from a request event you can also use e.FindUploadedFiles("fileKey")
f1, _ := filesystem.NewFileFromPath("/local/path/to/file1.txt")
f2, _ := filesystem.NewFileFromBytes([]byte{"test content"}, "file2.txt")
f3, _ := filesystem.NewFileFromURL(context.Background(), "https://example.com/file3.pdf")
record.Set("documents", []*filesystem.File{f1, f2, f3})

// validate and persist
// (use SaveNoValidate to skip fields validation)
err = app.Save(record);
if err != nil {
    return err
}
```

##### Intercept create request

```
import (
    "github.com/pocketbase/pocketbase/core"
)

...

app.OnRecordCreateRequest("articles").BindFunc(func(e *core.RecordRequestEvent) error {
    // ignore for superusers
    if e.HasSuperuserAuth() {
        return e.Next()
    }

    // overwrite the submitted "status" field value
    e.Record.Set("status", "pending")

    // or you can also prevent the create event by returning an error
    status := e.Record.GetString("status")
    if (status != "pending" &&
        // guest or not an editor
        (e.Auth == nil || e.Auth.GetString("role") != "editor")) {
        return e.BadRequestError("Only editors can set a status different from pending", nil)
    }

    return e.Next()
})
```

### Update existing record

##### Update existing record programmatically

```
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

record.Set("title", "Lorem ipsum")

// delete existing record files by specifying their file names
record.Set("documents-", []string{"file1_abc123.txt", "file3_abc123.txt"})

// append one or more new files to the already uploaded list
//
// note1: see all factories in https://pkg.go.dev/github.com/pocketbase/pocketbase/tools/filesystem#File
// note2: for reading files from a request event you can also use e.FindUploadedFiles("fileKey")
f1, _ := filesystem.NewFileFromPath("/local/path/to/file1.txt")
f2, _ := filesystem.NewFileFromBytes([]byte{"test content"}, "file2.txt")
f3, _ := filesystem.NewFileFromURL(context.Background(), "https://example.com/file3.pdf")
record.Set("documents+", []*filesystem.File{f1, f2, f3})

// validate and persist
// (use SaveNoValidate to skip fields validation)
err = app.Save(record);
if err != nil {
    return err
}
```

##### Intercept update request

```
import (
    "github.com/pocketbase/pocketbase/core"
)

...

app.OnRecordUpdateRequest("articles").Add(func(e *core.RecordRequestEvent) error {
    // ignore for superusers
    if e.HasSuperuserAuth() {
        return e.Next()
    }

    // overwrite the submitted "status" field value
    e.Record.Set("status", "pending")

    // or you can also prevent the update event by returning an error
    status := e.Record.GetString("status")
    if (status != "pending" &&
        // guest or not an editor
        (e.Auth == nil || e.Auth.GetString("role") != "editor")) {
        return e.BadRequestError("Only editors can set a status different from pending", nil)
    }

    return e.Next()
})
```

### Delete record

```
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

err = app.Delete(record)
if err != nil {
    return err
}
```

### Transaction

 To execute multiple queries in a transaction you can use
    app.RunInTransaction(fn)
    .

 The DB operations are persisted only if the transaction returns nil.

 It is safe to nest RunInTransaction calls as long as you use the callback's
    txApp argument.

 Inside the transaction function always use its txApp argument and not the original
            app instance because we allow only a single writer/transaction at a time and it could
            result in a deadlock.

 To avoid performance issues, try to minimize slow/long running tasks such as sending emails,
            connecting to external services, etc. as part of the transaction.

```
import (
    "github.com/pocketbase/pocketbase/core"
)

...

titles := []string{"title1", "title2", "title3"}

collection, err := app.FindCollectionByNameOrId("articles")
if err != nil {
    return err
}

// create new record for each title
app.RunInTransaction(func(txApp core.App) error {
    for _, title := range titles {
        record := core.NewRecord(collection)
        record.Set("title", title)

        if err := txApp.Save(record); err != nil {
            return err
        }
    }

    return nil
})
```

### Programmatically expanding relations

 To expand record relations programmatically you can use
    app.ExpandRecord(record, expands, optFetchFunc)
    for single or
    app.ExpandRecords(records, expands, optFetchFunc)
    for multiple records.

 Once loaded, you can access the expanded relations via
    record.ExpandedOne(relName)
    or
    record.ExpandedAll(relName) .

 For example:

```
record, err := app.FindFirstRecordByData("articles", "slug", "lorem-ipsum")
if err != nil {
    return err
}

// expand the "author" and "categories" relations
errs := app.ExpandRecord(record, []string{"author", "categories"}, nil)
if len(errs) > 0 {
    return fmt.Errorf("failed to expand: %v", errs)
}

// print the expanded records
log.Println(record.ExpandedOne("author"))
log.Println(record.ExpandedAll("categories"))
```

### Check if record can be accessed

 To check whether a custom client request or user can access a single record, you can use the
    app.CanAccessRecord(record, requestInfo, rule)
    method.

 Below is an example of creating a custom route to retrieve a single article and checking if the request
    satisfy the View API rule of the record collection:

```
package main

import (
    "log"
    "net/http"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.GET("/articles/{slug}", func(e *core.RequestEvent) error {
            slug := e.Request.PathValue("slug")

            record, err := e.App.FindFirstRecordByData("articles", "slug", slug)
            if err != nil {
                return e.NotFoundError("Missing or invalid slug", err)
            }

            info, err := e.RequestInfo()
            if err != nil {
                return e.BadRequestError("Failed to retrieve request info", err)
            }

            canAccess, err := e.App.CanAccessRecord(record, info, record.Collection().ViewRule)
            if !canAccess {
                return e.ForbiddenError("", err)
            }

            return e.JSON(http.StatusOK, record)
        })

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Generating and validating tokens

 PocketBase Web APIs are fully stateless (aka. there are no sessions in the traditional sense) and an auth
    record is considered authenticated if the submitted request contains a valid
    Authorization: TOKEN
    header
    (see also Builtin auth middlewares and
        Retrieving the current auth state from a route
        )
    .

 If you want to issue and verify manually a record JWT (auth, verification, password reset, etc.), you
    could do that using the record token type specific methods:

```
token, err := record.NewAuthToken()

token, err := record.NewVerificationToken()

token, err := record.NewPasswordResetToken()

token, err := record.NewEmailChangeToken(newEmail)

token, err := record.NewFileToken() // for protected files

token, err := record.NewStaticAuthToken(optCustomDuration) // nonrenewable auth token
```

 Each token type has its own secret and the token duration is managed via its type related collection auth
    option (the only exception is NewStaticAuthToken).

 To validate a record token you can use the
    app.FindAuthRecordByToken
    method. The token related auth record is returned only if the token is not expired and its signature is valid.

 Here is an example how to validate an auth token:

```
record, err := app.FindAuthRecordByToken("YOUR_TOKEN", core.TokenTypeAuth)
```

## Collection operations

- Route: `/docs/go-collections`
- Source Svelte: `src/routes/(app)/docs/go-collections/+page.svelte`

Collections are usually managed via the Dashboard interface, but there are some situations where you may
    want to create or edit a collection programmatically (usually as part of a
    DB migration). You can find all available Collection related operations
    and methods in
    core.App
    and
    core.Collection
    , but below are listed some of the most common ones:

### Fetch collections

##### Fetch single collection

 All single collection retrieval methods return nil and sql.ErrNoRows error if no
    collection is found.

```
collection, err := app.FindCollectionByNameOrId("example")
```

##### Fetch multiple collections

 All multiple collections retrieval methods return empty slice and nil error if no collections
    are found.

```
allCollections, err := app.FindAllCollections()

authAndViewCollections, err := app.FindAllCollections(core.CollectionTypeAuth, core.CollectionTypeView)
```

##### Custom collection query

 In addition to the above query helpers, you can also create custom Collection queries using
    CollectionQuery()
    method. It returns a SELECT DB builder that can be used with the same methods described in the
    Database guide.

```
import (
    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase/core"
)

...

func FindSystemCollections(app core.App) ([]*core.Collection, error) {
    collections := []*core.Collection{}

    err := app.CollectionQuery().
        AndWhere(dbx.HashExp{"system": true}).
        OrderBy("created DESC").
        All(&collections)

    if err != nil {
        return nil, err
    }

    return collections, nil
}
```

### Collection properties

```
Id      string
Name    string
Type    string // "base", "view", "auth"
System  bool // !prevent collection rename, deletion and rules change of internal collections like _superusers
Fields  core.FieldsList
Indexes types.JSONArray[string]
Created types.DateTime
Updated types.DateTime

// CRUD rules
ListRule   *string
ViewRule   *string
CreateRule *string
UpdateRule *string
DeleteRule *string

// "view" type specific options
// (see https://github.com/pocketbase/pocketbase/blob/master/core/collection_model_view_options.go)
ViewQuery string

// "auth" type specific options
// (see https://github.com/pocketbase/pocketbase/blob/master/core/collection_model_auth_options.go)
AuthRule                   *string
ManageRule                 *string
AuthAlert                  core.AuthAlertConfig
OAuth2                     core.OAuth2Config
PasswordAuth               core.PasswordAuthConfig
MFA                        core.MFAConfig
OTP                        core.OTPConfig
AuthToken                  core.TokenConfig
PasswordResetToken         core.TokenConfig
EmailChangeToken           core.TokenConfig
VerificationToken          core.TokenConfig
FileToken                  core.TokenConfig
VerificationTemplate       core.EmailTemplate
ResetPasswordTemplate      core.EmailTemplate
ConfirmEmailChangeTemplate core.EmailTemplate
```

### Field definitions

- core.BoolField
- core.NumberField
- core.TextField
- core.EmailField
- core.URLField
- core.EditorField
- core.DateField
- core.AutodateField
- core.SelectField
- core.FileField
- core.RelationField
- core.JSONField
- core.GeoPointField

### Create new collection

```
import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"
)

...

// core.NewAuthCollection("example")
// core.NewViewCollection("example")
collection := core.NewBaseCollection("example")

// set rules
collection.ViewRule = types.Pointer("@request.auth.id != ''")
collection.CreateRule = types.Pointer("@request.auth.id != '' && @request.body.user = @request.auth.id")
collection.UpdateRule = types.Pointer(`
    @request.auth.id != '' &&
    user = @request.auth.id &&
    (@request.body.user:isset = false || @request.body.user = @request.auth.id)
`)

// add text field
collection.Fields.Add(&core.TextField{
    Name:     "title",
    Required: true,
    Max:      100,
})

// add relation field
usersCollection, err := app.FindCollectionByNameOrId("users")
if err != nil {
    return err
}
collection.Fields.Add(&core.RelationField{
    Name:          "user",
    Required:      true,
    Max:           100,
    CascadeDelete: true,
    CollectionId:  usersCollection.Id,
})

// add autodate/timestamp fields (created/updated)
collection.Fields.Add(&core.AutodateField{
    Name:     "created",
    OnCreate: true,
})
collection.Fields.Add(&core.AutodateField{
    Name:     "updated",
    OnCreate: true,
    OnUpdate: true,
})

// or: collection.Indexes = []string{"CREATE UNIQUE INDEX idx_example_user ON example (user)"}
collection.AddIndex("idx_example_user", true, "user", "")

// validate and persist
// (use SaveNoValidate to skip fields validation)
err = app.Save(collection)
if err != nil {
    return err
}
```

### Update existing collection

```
import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"
)

...

collection, err := app.FindCollectionByNameOrId("example")
if err != nil {
    return err
}

// change rule
collection.DeleteRule = types.Pointer("@request.auth.id != ''")

// add new editor field
collection.Fields.Add(&core.EditorField{
    Name:     "description",
    Required: true,
})

// change existing field
// (returns a pointer and direct modifications are allowed without the need of reinsert)
titleField := collection.Fields.GetByName("title").(*core.TextField)
titleField.Min = 10

// or: collection.Indexes = append(collection.Indexes, "CREATE INDEX idx_example_title ON example (title)")
collection.AddIndex("idx_example_title", false, "title", "")

// validate and persist
// (use SaveNoValidate to skip fields validation)
err = app.Save(collection)
if err != nil {
    return err
}
```

### Delete collection

```
collection, err := app.FindCollectionByNameOrId("example")
if err != nil {
    return err
}

err = app.Delete(collection)
if err != nil {
    return err
}
```

## Migrations

- Route: `/docs/go-migrations`
- Source Svelte: `src/routes/(app)/docs/go-migrations/+page.svelte`

PocketBase comes with a builtin DB and data migration utility, allowing you to version your DB structure,
    create collections programmatically, initialize default settings, etc.

 Because the migrations are regular Go functions, besides applying schema changes, they could be used also
    to adjust existing data to fit the new schema or any other app specific logic that you want to run only
    once.

 And as a bonus, being .go files also ensure that the migrations will be embedded seamlessly in
    your final executable.

### Quick setup

##### 0. Register the migrate command

 You can find all available config options in the
        migratecmd
        subpackage.

```
// main.go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/plugins/migratecmd"
    "github.com/pocketbase/pocketbase/tools/osutils"

    // enable once you have at least one migration
    // _ "yourpackage/migrations"
)

func main() {
    app := pocketbase.New()

    migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
        // enable auto creation of migration files when making collection changes in the Dashboard
        // (the IsProbablyGoRun check is to enable it only during development)
        Automigrate: osutils.IsProbablyGoRun(),
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

##### 1. Create new migration

 To create a new blank migration you can run migrate create.

```
// Since the "create" command makes sense only during development,
// it is expected the user to be in the app working directory
// and to be using "go run"

[root@dev app]$ go run . migrate create "your_new_migration"
```

```
// migrations/1655834400_your_new_migration.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        // add up queries...

        return nil
    }, func(app core.App) error {
        // add down queries...

        return nil
    })
}
```

 The above will create a new blank migration file inside the default command migrations directory.

 Each migration file should have a single m.Register(upFunc, downFunc) call.

 In the migration file, you are expected to write your "upgrade" code in the upFunc callback.

    The downFunc is optional and it should contain the "downgrade" operations to revert the
    changes made by the upFunc.

    Both callbacks accept a transactional core.App instance.

 You can explore the
            Database guide,
            Collection operations and
            Record operations
            for more details how to interact with the database. You can also find
            some examples further below in this guide.

##### 2. Load migrations

 To make your application aware of the registered migrations, you have to import the above
    migrations package in one of your main package files:

```
package main

import _ "yourpackage/migrations"

// ...
```

##### 3. Run migrations

 New unapplied migrations are automatically executed when the application server starts, aka. on
    serve.

 Alternatively, you can also apply new migrations manually by running migrate up.

    To revert the last applied migration(s), you can run migrate down [number].

 When manually applying or reverting migrations, the serve process needs to be restarted so
        that it can refresh its cached collections state.

### Collections snapshot

 The migrate collections command generates a full snapshot of your current collections
    configuration without having to type it manually. Similar to the migrate create command, this
    will generate a new migration file in the
    migrations directory.

```
// Since the "collections" command makes sense only during development,
// it is expected the user to be in the app working directory
// and to be using "go run"

[root@dev app]$ go run . migrate collections
```

 By default the collections snapshot is imported in extend mode, meaning that collections and
    fields that don't exist in the snapshot are preserved. If you want the snapshot to delete
    missing collections and fields, you can edit the generated file and change the last argument of
    ImportCollectionsByMarshaledJSON method to true.

### Migrations history

 All applied migration filenames are stored in the internal _migrations table.

    During local development often you might end up making various collection changes to test different approaches.

    When Automigrate is enabled this could lead in a migration history with unnecessary intermediate
    steps that may not be wanted in the final migration history.

 To avoid the clutter and to prevent applying the intermediate steps in production, you can remove (or
    squash) the unnecessary migration files manually and then update the local migrations history by running:

```
[root@dev app]$ go run . migrate history-sync
```

 The above command will remove any entry from the _migrations table that doesn't have a related
    migration file associated with it.

### Examples

##### Executing raw SQL statements

```
// migrations/1687801090_set_pending_status.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

// set a default "pending" status to all empty status articles
func init() {
    m.Register(func(app core.App) error {
        _, err := app.DB().NewQuery("UPDATE articles SET status = 'pending' WHERE status = ''").Execute()
        return err
    }, nil)
}
```

##### Initialize default application settings

```
// migrations/1687801090_initial_settings.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        settings := app.Settings()

        // for all available settings fields you could check
        // https://github.com/pocketbase/pocketbase/blob/develop/core/settings_model.go#L121-L130
        settings.Meta.AppName = "test"
        settings.Meta.AppURL = "https://example.com"
        settings.Logs.MaxDays = 2
        settings.Logs.LogAuthId = true
        settings.Logs.LogIP = false

        return app.Save(settings)
    }, nil)
}
```

##### Creating initial superuser

 For all supported record methods, you can refer to
        Record operations
    .

 You can also create the initial super user using the
        ./pocketbase superuser create EMAIL PASS
        command.

```
// migrations/1687801090_initial_superuser.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
        if err != nil {
            return err
        }

        record := core.NewRecord(superusers)

        // note: the values can be eventually loaded via os.Getenv(key)
        // or from a special local config file
        record.Set("email", "test@example.com")
        record.Set("password", "1234567890")

        return app.Save(record)
    }, func(app core.App) error { // optional revert operation
        record, _ := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test@example.com")
        if record == nil {
            return nil // probably already deleted
        }

        return app.Delete(record)
    })
}
```

##### Creating collection programmatically

 For all supported collection methods, you can refer to
        Collection operations
    .

```
// migrations/1687801090_create_clients_collection.go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"

    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        // init a new auth collection with the default system fields and auth options
        collection := core.NewAuthCollection("clients")

        // restrict the list and view rules for record owners
        collection.ListRule = types.Pointer("id = @request.auth.id")
        collection.ViewRule = types.Pointer("id = @request.auth.id")

        // add extra fields in addition to the default ones
        collection.Fields.Add(
            &core.TextField{
                Name:     "company",
                Required: true,
                Max:      100,
            },
            &core.URLField{
                Name:        "website",
                Presentable: true,
            },
        )

        // disable password auth and enable OTP only
        collection.PasswordAuth.Enabled = false
        collection.OTP.Enabled = true

        collection.AddIndex("idx_clients_company", false, "company", "")

        return app.Save(collection)
    }, func(app core.App) error { // optional revert operation
        collection, err := app.FindCollectionByNameOrId("clients")
        if err != nil {
            return err
        }

        return app.Delete(collection)
    })
}
```

## Jobs scheduling

- Route: `/docs/go-jobs-scheduling`
- Source Svelte: `src/routes/(app)/docs/go-jobs-scheduling/+page.svelte`

If you have tasks that need to be performed periodically, you could set up crontab-like jobs with the
    builtin app.Cron() (it returns an app scoped
        cron.Cron value)
    .

 The jobs scheduler is started automatically on app serve, so all you have to do is register a
    handler with
    app.Cron().Add(id, cronExpr, handler)
    or
    app.Cron().MustAdd(id, cronExpr, handler)
    (the latter panic if the cron expression is not valid).

 Each scheduled job runs in its own goroutine and must have:

- id - identifier for the scheduled job; could be used to replace or remove an existing
        job
- cron expression - e.g. 0 0 * * * (
        supports numeric list, steps, ranges or
            macros )
- handler - the function that will be executed every time when the job runs

 Here is one minimal example:

```
// main.go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
)

func main() {
    app := pocketbase.New()

    // prints "Hello!" every 2 minutes
    app.Cron().MustAdd("hello", "*/2 * * * *", func() {
        log.Println("Hello!")
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

 To remove already registered cron job you can call
    app.Cron().Remove(id)

 All registered app level cron jobs can be also previewed and triggered from the
    Dashboard > Settings > Crons section.

 Keep in mind that the app.Cron() is also used for running the system scheduled jobs
            like the logs cleanup or auto backups (the jobs id is in the format __pb*__) and
            replacing these system jobs or calling RemoveAll()/Stop() could have unintended
            side-effects.

 If you want more advanced control you can initialize your own cron instance independent from the
            application via cron.New().

## Sending emails

- Route: `/docs/go-sending-emails`
- Source Svelte: `src/routes/(app)/docs/go-sending-emails/+page.svelte`

PocketBase provides a simple abstraction for sending emails via the
    app.NewMailClient() factory.

 Depending on your configured mail settings (Dashboard > Settings > Mail settings) it will use the
    sendmail command or a SMTP client.

### Send custom email

 You can send your own custom email from anywhere within the app (hooks, middlewares, routes, etc.) by
    using app.NewMailClient().Send(message). Here is an example of sending a custom email after
    user registration:

```
// main.go
package main

import (
    "log"
    "net/mail"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/mailer"
)

func main() {
    app := pocketbase.New()

    app.OnRecordCreateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
        if err := e.Next(); err != nil {
            return err
        }

        message := &mailer.Message{
            From: mail.Address{
                Address: e.App.Settings().Meta.SenderAddress,
                Name:    e.App.Settings().Meta.SenderName,
            },
            To:      []mail.Address{{Address: e.Record.Email()}},
            Subject: "YOUR_SUBJECT...",
            HTML:    "YOUR_HTML_BODY...",
            // bcc, cc, attachments and custom headers are also supported...
        }

        return e.App.NewMailClient().Send(message)
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### Overwrite system emails

 If you want to overwrite the default system emails for forgotten password, verification, etc., you can
    adjust the default templates available from the
    Dashboard > Collections > Edit collection > Options
    .

 Alternatively, you can also apply individual changes by binding to one of the
    mailer hooks. Here is an example of appending a Record
    field value to the subject using the OnMailerRecordPasswordResetSend hook:

```
// main.go
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
)

func main() {
    app := pocketbase.New()

    app.OnMailerRecordPasswordResetSend("users").BindFunc(func(e *core.MailerRecordEvent) error {
        // modify the subject
        e.Message.Subject += (" " + e.Record.GetString("name"))

        return e.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## Rendering templates

- Route: `/docs/go-rendering-templates`
- Source Svelte: `src/routes/(app)/docs/go-rendering-templates/+page.svelte`

### Overview

 A common task when creating custom routes or emails is the need of generating HTML output.

 There are plenty of Go template-engines available that you can use for this, but often for simple cases
    the Go standard library html/template package should work just fine.

 To make it slightly easier to load template files concurrently and on the fly, PocketBase also provides a
    thin wrapper around the standard library in the
    github.com/pocketbase/pocketbase/tools/template
    utility package.

```
import "github.com/pocketbase/pocketbase/tools/template"

data := map[string]any{"name": "John"}

html, err := template.NewRegistry().LoadFiles(
    "views/base.html",
    "views/partial1.html",
    "views/partial2.html",
).Render(data)
```

 The general flow when working with composed and nested templates is that you create "base" template(s)
    that defines various placeholders using the
    {{template "placeholderName" .}} or
    {{block "placeholderName" .}}default...{{end}} actions.

 Then in the partials, you define the content for those placeholders using the
    {{define "placeholderName"}}custom...{{end}} action.

 The dot object (.) in the above represents the data passed to the templates
    via the Render(data) method.

 By default the templates apply contextual (HTML, JS, CSS, URI) auto escaping so the generated template
    content should be injection-safe. To render raw/verbatim trusted content in the templates you can use the
    builtin raw function (e.g. {{.content|raw}}).

 For more information about the template syntax please refer to the
            html/template
            and
            text/template
            package godocs.
            Another great resource is also the Hashicorp's
                Learn Go Template Syntax
                tutorial.

### Example HTML page with layout

 Consider the following app directory structure:

```
myapp/
    views/
        layout.html
        hello.html
    main.go
```

 We define the content for layout.html as:

```

    {{block "title" .}}Default app title{{end}}

    Header...

    {{block "body" .}}
        Default app body...
    {{end}}

    Footer...

```

 We define the content for hello.html as:

```
{{define "title"}}
    Page 1
{{end}}

{{define "body"}}
    Hello from {{.name}}

{{end}}
```

 Then to output the final page, we'll register a custom /hello/:name route:

```
// main.go
package main

import (
    "log"
    "net/http"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/template"
)

func main() {
    app := pocketbase.New()

    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // this is safe to be used by multiple goroutines
        // (it acts as store for the parsed templates)
        registry := template.NewRegistry()

        se.Router.GET("/hello/{name}", func(e *core.RequestEvent) error {
            name := e.Request.PathValue("name")

            html, err := registry.LoadFiles(
                "views/layout.html",
                "views/hello.html",
            ).Render(map[string]any{
                "name": name,
            })

            if err != nil {
                // or redirect to a dedicated 404 HTML page
                return e.NotFoundError("", err)
            }

            return e.HTML(http.StatusOK, html)
        })

        return se.Next()
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

## Console commands

- Route: `/docs/go-console-commands`
- Source Svelte: `src/routes/(app)/docs/go-console-commands/+page.svelte`

You can register custom console commands using
    app.RootCmd.AddCommand(cmd), where cmd is a
    cobra command.

 Here is an example:

```
package main

import (
    "log"

    "github.com/pocketbase/pocketbase"
    "github.com/spf13/cobra"
)

func main() {
    app := pocketbase.New()

    app.RootCmd.AddCommand(&cobra.Command{
        Use: "hello",
        Run: func(cmd *cobra.Command, args []string) {
            log.Println("Hello world!")
        },
    })

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

 To run the command you can build your Go application and execute:

```
# or "go run main.go hello"
./myapp hello
```

 Keep in mind that the console commands execute in their own separate app process and run
            independently from the main serve command (aka. hook and realtime events between different
            processes are not shared with one another).

## Realtime messaging

- Route: `/docs/go-realtime`
- Source Svelte: `src/routes/(app)/docs/go-realtime/+page.svelte`

By default PocketBase sends realtime events only for Record create/update/delete operations (and for the OAuth2 auth redirect), but you are free to send custom realtime messages to the connected clients via the
    app.SubscriptionsBroker() instance.

 app.SubscriptionsBroker().Clients()
    returns all connected
    subscriptions.Client
    indexed by their unique connection id.

 app.SubscriptionsBroker().ChunkedClients(size)
    is similar but returns the result as a chunked slice allowing you to split the iteration across several goroutines
    (usually combined with
    errgroup
    ).

 The current auth record associated with a client could be accessed through
    client.Get(apis.RealtimeClientAuthKey)

 Note that a single authenticated user could have more than one active realtime connection (aka.
            multiple clients). This could happen for example when opening the same app in different tabs,
            browsers, devices, etc.

 Below you can find a minimal code sample that sends a JSON payload to all clients subscribed to the
    "example" topic:

```
func notify(app core.App, subscription string, data any) error {
    rawData, err := json.Marshal(data)
    if err != nil {
        return err
    }

    message := subscriptions.Message{
        Name: subscription,
        Data: rawData,
    }

    group := new(errgroup.Group)

    chunks := app.SubscriptionsBroker().ChunkedClients(300)

    for _, chunk := range chunks {
        group.Go(func() error {
            for _, client := range chunk {
                if !client.HasSubscription(subscription) {
                    continue
                }

                client.Send(message)
            }

            return nil
        })
    }

    return group.Wait()
}

err := notify(app, "example", map[string]any{"test": 123})
if err != nil {
    return err
}
```

 From the client-side, users can listen to the custom subscription topic by doing something like:

 JavaScript

 Dart

```
import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

...

await pb.realtime.subscribe('example', (e) => {
    console.log(e)
})
```

```
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('http://127.0.0.1:8090');

...

await pb.realtime.subscribe('example', (e) {
    print(e)
})
```

## Filesystem

- Route: `/docs/go-filesystem`
- Source Svelte: `src/routes/(app)/docs/go-filesystem/+page.svelte`

PocketBase comes with a thin abstraction between the local filesystem and S3.

 To configure which one will be used you can adjust the storage settings from
    Dashboard > Settings > Files storage section.

 The filesystem abstraction can be accessed programmatically via the
    app.NewFilesystem()
    method.

 Below are listed some of the most common operations but you can find more details in the
    filesystem
    subpackage.

 Always make sure to call Close() at the end for both the created filesystem instance and
            the retrieved file readers to prevent leaking resources.

### Reading files

 To retrieve the file content of a single stored file you can use
    GetReader(key)
    .

    Note that file keys often contain a prefix (aka. the "path" to the file). For record
    files the full key is
    collectionId/recordId/filename.

    To retrieve multiple files matching a specific prefix you can use
    List(prefix)
    .

 The below code shows a minimal example how to retrieve a single record file and copy its content into a
    bytes.Buffer.

```
record, err := app.FindAuthRecordByEmail("users", "test@example.com")
if err != nil {
    return err
}

// construct the full file key by concatenating the record storage path with the specific filename
avatarKey := record.BaseFilesPath() + "/" + record.GetString("avatar")

// initialize the filesystem
fsys, err := app.NewFilesystem()
if err != nil {
    return err
}
defer fsys.Close()

// retrieve a file reader for the avatar key
r, err := fsys.GetReader(avatarKey)
if err != nil {
    return err
}
defer r.Close()

// do something with the reader...
content := new(bytes.Buffer)
_, err = io.Copy(content, r)
if err != nil {
    return err
}
```

### Saving files

 There are several methods to save (aka. write/upload) files depending on the available file content
    source:

- Upload([]byte, key)
- UploadFile(*filesystem.File, key)
- UploadMultipart(*multipart.FileHeader, key)

 Most users rarely will have to use the above methods directly because for collection records the file
    persistence is handled transparently when saving the record model (it will also perform size and MIME type
    validation based on the collection file field options). For example:

```
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

// Other available File factories
// - filesystem.NewFileFromBytes(data, name)
// - filesystem.NewFileFromURL(ctx, url)
// - filesystem.NewFileFromMultipart(mh)
f, err := filesystem.NewFileFromPath("/local/path/to/file")

// set new file (can be single *filesytem.File or multiple []*filesystem.File)
// (if the record has an old file it is automatically deleted on successful Save)
record.Set("yourFileField", f)

err = app.Save(record)
if err != nil {
    return err
}
```

### Deleting files

 Files can be deleted from the storage filesystem using
    Delete(key)
    .

 Similar to the previous section, most users rarely will have to use the Delete file method directly
    because for collection records the file deletion is handled transparently when removing the existing filename
    from the record model (this also ensures that the db entry referencing the file is also removed). For example:

```
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

// if you want to "reset" a file field (aka. deleting the associated single or multiple files)
// you can set it to nil
record.Set("yourFileField", nil)

// OR if you just want to remove individual file(s) from a multiple file field you can use the "-" modifier
// (the value could be a single filename string or slice of filename strings)
record.Set("yourFileField-", "example_52iWbGinWd.txt")

err = app.Save(record)
if err != nil {
    return err
}
```

## Logging

- Route: `/docs/go-logging`
- Source Svelte: `src/routes/(app)/docs/go-logging/+page.svelte`

app.Logger() provides access to a standard slog.Logger implementation that
    writes any logs into the database so that they can be later explored from the PocketBase
    Dashboard > Logs section.

 For better performance and to minimize blocking on hot paths, logs are written with debounce and
            on batches:

- 3 seconds after the last debounced log write
- when the batch threshold is reached (currently 200)
- right before app termination to attempt saving everything from the existing logs queue

### Log methods

 All standard
    slog.Logger
    methods are available but below is a list with some of the most notable ones.

##### Debug(message, attrs...)

```
app.Logger().Debug("Debug message!")

app.Logger().Debug(
    "Debug message with attributes!",
    "name", "John Doe",
    "id", 123,
)
```

##### Info(message, attrs...)

```
app.Logger().Info("Info message!")

app.Logger().Info(
    "Info message with attributes!",
    "name", "John Doe",
    "id", 123,
)
```

##### Warn(message, attrs...)

```
app.Logger().Warn("Warning message!")

app.Logger().Warn(
    "Warning message with attributes!",
    "name", "John Doe",
    "id", 123,
)
```

##### Error(message, attrs...)

```
app.Logger().Error("Error message!")

app.Logger().Error(
    "Error message with attributes!",
    "id", 123,
    "error", err,
)
```

##### With(attrs...)

 With(atrs...) creates a new local logger that will "inject" the specified attributes with each
    following log.

```
l := app.Logger().With("total", 123)

// results in log with data {"total": 123}
l.Info("message A")

// results in log with data {"total": 123, "name": "john"}
l.Info("message B", "name", "john")
```

##### WithGroup(name)

 WithGroup(name) creates a new local logger that wraps all logs attributes under the specified
    group name.

```
l := app.Logger().WithGroup("sub")

// results in log with data {"sub": { "total": 123 }}
l.Info("message A", "total", 123)
```

### Logs settings

 You can control various log settings like logs retention period, minimal log level, request IP logging,
    etc. from the logs settings panel:

### Custom log queries

 The logs are usually meant to be filtered from the UI but if you want to programmatically retrieve and
    filter the stored logs you can make use of the
    app.LogQuery() query builder method. For example:

```
logs := []*core.Log{}

// see https://pocketbase.io/docs/go-database/#query-builder
err := app.LogQuery().
    // target only debug and info logs
    AndWhere(dbx.In("level", -4, 0).
    // the data column is serialized json object and could be anything
    AndWhere(dbx.NewExp("json_extract(data, '$.type') = 'request'")).
    OrderBy("created DESC").
    Limit(100).
    All(&logs)
```

### Intercepting logs write

 If you want to modify the log data before persisting in the database or to forward it to an external
    system, then you can listen for changes of the _logs table by attaching to the
    base model hooks. For example:

```
app.OnModelCreate(core.LogsTableName).BindFunc(func(e *core.ModelEvent) error {
    l := e.Model.(*core.Log)

    fmt.Println(l.Id)
    fmt.Println(l.Created)
    fmt.Println(l.Level)
    fmt.Println(l.Message)
    fmt.Println(l.Data)

    return e.Next()
})
```

## Testing

- Route: `/docs/go-testing`
- Source Svelte: `src/routes/(app)/docs/go-testing/+page.svelte`

PocketBase exposes several test mocks and stubs (eg. tests.TestApp,
    tests.ApiScenario, tests.MockMultipartData, etc.) to help you write unit and
    integration tests for your app.

 You could find more information in the
    github.com/pocketbase/pocketbase/tests
    sub package, but here is a simple example.

### 1. Setup

 Let's say that we have a custom API route GET /my/hello that requires superuser authentication:

```
// main.go
package main

import (
    "log"
    "net/http"

    "github.com/pocketbase/pocketbase"
    "github.com/pocketbase/pocketbase/apis"
    "github.com/pocketbase/pocketbase/core"
)

func bindAppHooks(app core.App) {
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.Get("/my/hello", func(e *core.RequestEvent) error {
            return e.JSON(http.StatusOK, "Hello world!")
        }).Bind(apis.RequireSuperuserAuth())

        return se.Next()
    })
}

func main() {
    app := pocketbase.New()

    bindAppHooks(app)

    if err := app.Start(); err != nil {
        log.Fatal(err)
    }
}
```

### 2. Prepare test data

 Now we have to prepare our test/mock data. There are several ways you can approach this, but the easiest
    one would be to start your application with a custom test_pb_data directory, e.g.:

```
./pocketbase serve --dir="./test_pb_data" --automigrate=0
```

 Go to your browser and create the test data via the Dashboard (both collections and records). Once
    completed you can stop the server (you could also commit test_pb_data to your repo).

### 3. Integration test

 To test the example endpoint, we want to:

- ensure it handles only GET requests
- ensure that it can be accessed only by superusers
- check if the response body is properly set

 Below is a simple integration test for the above test cases. We'll also use the test data created in the
    previous step.

```
// main_test.go
package main

import (
    "net/http"
    "testing"

    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tests"
)

const testDataDir = "./test_pb_data"

func generateToken(collectionNameOrId string, email string) (string, error) {
    app, err := tests.NewTestApp(testDataDir)
    if err != nil {
        return "", err
    }
    defer app.Cleanup()

    record, err := app.FindAuthRecordByEmail(collectionNameOrId, email)
    if err != nil {
        return "", err
    }

    return record.NewAuthToken()
}

func TestHelloEndpoint(t *testing.T) {
    recordToken, err := generateToken("users", "test@example.com")
    if err != nil {
        t.Fatal(err)
    }

    superuserToken, err := generateToken(core.CollectionNameSuperusers, "test@example.com")
    if err != nil {
        t.Fatal(err)
    }

    // set up the test ApiScenario app instance
    setupTestApp := func(t testing.TB) *tests.TestApp {
        testApp, err := tests.NewTestApp(testDataDir)
        if err != nil {
            t.Fatal(err)
        }
        // no need to cleanup since scenario.Test() will do that for us
        // defer testApp.Cleanup()

        bindAppHooks(testApp)

        return testApp
    }

    scenarios := []tests.ApiScenario{
        {
            Name:            "try with different http method, e.g. POST",
            Method:          http.MethodPost,
            URL:             "/my/hello",
            ExpectedStatus:  405,
            ExpectedContent: []string{"\"data\":{}"},
            TestAppFactory:  setupTestApp,
        },
        {
            Name:            "try as guest (aka. no Authorization header)",
            Method:          http.MethodGet,
            URL:             "/my/hello",
            ExpectedStatus:  401,
            ExpectedContent: []string{"\"data\":{}"},
            TestAppFactory:  setupTestApp,
        },
        {
            Name:   "try as authenticated app user",
            Method: http.MethodGet,
            URL:    "/my/hello",
            Headers: map[string]string{
                "Authorization": recordToken,
            },
            ExpectedStatus:  401,
            ExpectedContent: []string{"\"data\":{}"},
            TestAppFactory:  setupTestApp,
        },
        {
            Name:   "try as authenticated superuser",
            Method: http.MethodGet,
            URL:    "/my/hello",
            Headers: map[string]string{
                "Authorization": superuserToken,
            },
            ExpectedStatus:  200,
            ExpectedContent: []string{"Hello world!"},
            TestAppFactory:  setupTestApp,
        },
    }

    for _, scenario := range scenarios {
        scenario.Test(t)
    }
}
```

## Miscellaneous

- Route: `/docs/go-miscellaneous`
- Source Svelte: `src/routes/(app)/docs/go-miscellaneous/+page.svelte`

### app.Store()

 app.Store()
    returns a concurrent-safe application memory store that you can use to store anything for the duration of the
    application process (e.g. cache, config flags, etc.).

 You can find more details about the available store methods in the
    store.Store
    documentation but the most commonly used ones are Get(key), Set(key, value) and
    GetOrSet(key, setFunc).

```
app.Store().Set("example", 123)

v1 := app.Store().Get("example").(int) // 123

v2 := app.Store().GetOrSet("example2", func() any {
    // this setter is invoked only once unless "example2" is removed
    // (e.g. suitable for instantiating singletons)
    return 456
}).(int) // 456
```

 Keep in mind that the application store is also used internally usually with pb*
            prefixed keys (e.g. the collections cache is stored under the pbAppCachedCollections
            key) and changing these system keys or calling RemoveAll()/Reset() could
            have unintended side-effects.

 If you want more advanced control you can initialize your own store independent from the
            application instance via
            store.New[K, T](nil).

### Security helpers

 Below are listed some of the most commonly used security helpers but you can find detailed
        documentation for all available methods in the
        security
        subpackage.

##### Generating random strings

```
secret := security.RandomString(10) // e.g. a35Vdb10Z4

secret := security.RandomStringWithAlphabet(5, "1234567890") // e.g. 33215
```

##### Compare strings with constant time

```
isEqual := security.Equal(hash1, hash2)
```

##### AES Encrypt/Decrypt

```
// must be random 32 characters string
const key = "p2oDUShL3sEaVQ1Lw1pPJa3IEdfRa7Z9"

encrypted, err := security.Encrypt([]byte("test"), key)
if err != nil {
    return err
}

decrypted := security.Decrypt(encrypted, key) // []byte("test")
```

## Record proxy

- Route: `/docs/go-record-proxy`
- Source Svelte: `src/routes/(app)/docs/go-record-proxy/+page.svelte`

The available core.Record and its helpers
    are usually the recommended way to interact with your data, but in case you want a typed access to your record
    fields you can create a helper struct that embeds
    core.BaseRecordProxy (which implements the core.RecordProxy interface) and define your collection fields as
    getters and setters.

 By implementing the core.RecordProxy interface you can use your custom struct as part of a
    RecordQuery result like a regular record model. In addition, every DB change through the proxy
    struct will trigger the corresponding record validations and hooks. This ensures that other parts of your app,
    including 3rd party plugins, that don't know or use your custom struct will still work as expected.

 Below is a sample Article record proxy implementation:

```
// article.go
package main

import (
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/types"
)

// ensures that the Article struct satisfy the core.RecordProxy interface
var _ core.RecordProxy = (*Article)(nil)

type Article struct {
    core.BaseRecordProxy
}

func (a *Article) Title() string {
    return a.GetString("title")
}

func (a *Article) SetTitle(title string) {
    a.Set("title", title)
}

func (a *Article) Slug() string {
    return a.GetString("slug")
}

func (a *Article) SetSlug(slug string) {
    a.Set("slug", slug)
}

func (a *Article) Created() types.DateTime {
    return a.GetDateTime("created")
}

func (a *Article) Updated() types.DateTime {
    return a.GetDateTime("updated")
}
```

 Accessing and modifying the proxy records is the same as for the regular records. Continuing with the
    above Article example:

```
func FindArticleBySlug(app core.App, slug string) (*Article, error) {
    article := &Article{}

    err := app.RecordQuery("articles").
        AndWhere(dbx.NewExp("LOWER(slug)={:slug}", dbx.Params{
            "slug": strings.ToLower(slug), // case insensitive match
        })).
        Limit(1).
        One(article)

    if err != nil {
        return nil, err
    }

    return article, nil
}

...

article, err := FindArticleBySlug(app, "example")
if err != nil {
    return err
}

// change the title
article.SetTitle("Lorem ipsum...")

// persist the change while also triggering the original record validations and hooks
err = app.Save(article)
if err != nil {
    return err
}
```

 If you have an existing *core.Record value you can also load it into your proxy using the
    SetProxyRecord method:

```
// fetch regular record
record, err := app.FindRecordById("articles", "RECORD_ID")
if err != nil {
    return err
}

// load into proxy
article := &Article{}
article.SetProxyRecord(record)
```
