import { Injectable, Optional, Inject } from '@angular/core';
import { Observable, ReplaySubject, fromEvent, of, throwError, race } from 'rxjs';
import { map, mergeMap, first, tap } from 'rxjs/operators';

import { LocalDatabase } from './local-database';
import { LocalStorageDatabase } from './localstorage-database';
import { LOCAL_STORAGE_PREFIX } from '../tokens';

@Injectable({
  providedIn: 'root'
})
export class IndexedDBDatabase implements LocalDatabase {

  /**
   * IndexedDB database name for local storage
   */
  protected dbName = 'ngStorage';
  /**
   * IndexedDB object store name for local storage
   */
  protected readonly objectStoreName = 'localStorage';
  /**
   * IndexedDB key path name for local storage (where an item's key will be stored)
   */
  protected readonly keyPath = 'key';
  /**
   * IndexedDB data path name for local storage (where items' value will be stored)
   */
  protected readonly dataPath = 'value';
  /**
   * IndexedDB database connection, wrapped in a RxJS ReplaySubject to be able to access the connection
   * even after the connection success event happened
   */
  protected database: ReplaySubject<IDBDatabase>;
  /**
   * IndexedDB is available but failing in some scenarios (Firefox private mode, Safari cross-origin iframes),
   * so a fallback can be needed.
   */
  protected fallback: LocalDatabase | null = null;

  get size(): Observable<number> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.size;
    }

    return this.transaction('readonly').pipe(
      mergeMap((transaction) => {

        /* Deleting the item in local storage */
        const request = transaction.count();

        const success = (fromEvent(request, 'success') as Observable<Event>).pipe(
          map((event) => (event.target as IDBRequest).result as number),
        );

        /* Merging success and errors events and autoclosing the observable */
        return (race(success, this.toErrorObservable(request, `length`)) as Observable<number>);

      }),
      first()
    );

  }

  /**
   * Connects to IndexedDB
   */
  constructor(@Optional() @Inject(LOCAL_STORAGE_PREFIX) protected prefix: string | null = null) {
    if (prefix) {

      this.dbName = `${prefix}_${this.dbName}`;

    }

    /* Creating the RxJS ReplaySubject */
    this.database = new ReplaySubject<IDBDatabase>();

    /* Connecting to IndexedDB */
    this.connect(prefix);

  }

  /**
   * Gets an item value in local storage
   * @param key The item's key
   * @returns The item's value if the key exists, null otherwise, wrapped in an RxJS Observable
   */
  getItem<T = any>(key: string): Observable<T | null> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.getItem<T>(key);
    }

    /* Opening a trasaction and requesting the item in local storage */
    return this.getItemFromTransaction<T>(key);

  }

  getAll<T=any[]>(): Observable<T[] | null> {
    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.getAll<T>();
    }

    return this.transaction('readonly').pipe(
      mergeMap((transaction) => {

        const request = transaction.getAll();

        const success = (fromEvent(request, 'success') as Observable<Event>).pipe(
          map((event) => (event.target as IDBRequest).result)
        );
        /* Merging success and errors events and autoclosing the observable */
        return (race(success, this.toErrorObservable(request)));
      })
      , first()
    );
  }
  /**
   * Internal method to factorize the getter for getItem and setItem,
   * the last one needing to be from a preexisting transaction
   * @param key The item's key
   * @param transactionParam Optional pre-existing transaction to use for the read request
   * @returns The item's value if the key exists, null otherwise, wrapped in an RxJS Observable
   */
  private getItemFromTransaction<T = any>(key: string, transactionParam?: IDBObjectStore): Observable<T | null> {

    const transaction$ = transactionParam ? of(transactionParam) : this.transaction();

    return transaction$.pipe(
      map((transaction) => transaction.get(key)),
      mergeMap((request) => {

        /* Listening to the success event, and passing the item value if found, null otherwise */
        const success = (fromEvent(request, 'success') as Observable<Event>).pipe(
          map((event) => (event.target as IDBRequest).result),
          map((result) => result ? (result as T) : null)
          // map((result) => result && (this.dataPath in result) ? (result[this.dataPath] as T) : null)
        );

        /* Merging success and errors events and autoclosing the observable */
        return (race(success, this.toErrorObservable(request, `getter`)));
      }),
      first()
    );

  }

  /**
   * Sets an item in local storage
   * @param key The item's key
   * @param data The item's value, must NOT be null or undefined
   * @returns An RxJS Observable to wait the end of the operation
   */
  setItem(key: string, data: any): Observable<boolean> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.setItem(key, data);
    }

    /* Storing null is not correctly supported by IndexedDB and unnecessary here */
    if (data == null) {

      return of(true);

    }

    /* Transaction must be the same for read and write, to avoid concurrency issues */
    const transaction$ = this.transaction('readwrite');
    let transaction: IDBObjectStore;

    /* Opening a transaction */
    return transaction$.pipe(
      tap((value) => {
        transaction = value;
      }),
      /* Check if the key already exists or not */
      mergeMap(() => this.getItemFromTransaction(key, transaction)),
      map((existingData) => (existingData == null) ? 'add' : 'put'),
      mergeMap((method) => {

        let request: IDBRequest;

        /* Adding or updating local storage, based on previous checking */
        switch (method) {
          case 'add':
            // request = transaction.add({ [this.dataPath]: data }, key);
            request = transaction.add(data, key);
            break;
          case 'put':
          default:
            // request = transaction.put({ [this.dataPath]: data }, key);
            request = transaction.put(data, key);
            break;
        }

        /* Merging success (passing true) and error events and autoclosing the observable */
        return (race(this.toSuccessObservable(request), this.toErrorObservable(request, `setter`)));

      }),
      first()
    );

  }

  /**
   * Deletes an item in local storage
   * @param key The item's key
   * @returns An RxJS Observable to wait the end of the operation
   */
  removeItem(key: string): Observable<boolean> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.removeItem(key);
    }

    /* Opening a transaction and checking if the item exists in local storage */
    return this.getItem(key).pipe(
      mergeMap((data) => {

        /* If the item exists in local storage */
        if (data != null) {

          /* Opening a transaction */
          return this.transaction('readwrite').pipe(mergeMap((transaction) => {

            /* Deleting the item in local storage */
            const request = transaction.delete(key);

            /* Merging success (passing true) and error events and autoclosing the observable */
            return (race(this.toSuccessObservable(request), this.toErrorObservable(request, `remover`)));

          }));

        }

        /* Passing true if the item does not exist in local storage */
        return of(true);

      }),
      first()
    );

  }

  /**
   * Deletes all items from local storage
   * @returns An RxJS Observable to wait the end of the operation
   */
  clear(): Observable<boolean> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.clear();
    }

    /* Opening a transaction */
    return this.transaction('readwrite').pipe(
      mergeMap((transaction) => {

        /* Deleting all items from local storage */
        const request = transaction.clear();

        /* Merging success (passing true) and error events and autoclosing the observable */
        return (race(this.toSuccessObservable(request), this.toErrorObservable(request, `clearer`)));

      }),
      first()
    );

  }

  keys(): Observable<string[]> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.keys();
    }

    return this.transaction('readonly').pipe(
      mergeMap((transaction) => {

        /* Deleting the item in local storage */
        const request = transaction.getAllKeys();

        const success = (fromEvent(request, 'success') as Observable<Event>).pipe(
          map((event) => (event.target as IDBRequest).result as string[])
        );

        /* Merging success and errors events and autoclosing the observable */
        return (race(success, this.toErrorObservable(request, `keys`)));

      }),
      first()
    );

  }

  has(key: string): Observable<boolean> {

    /* Fallback storage if set */
    if (this.fallback) {
      return this.fallback.has(key);
    }

    return this.transaction('readonly').pipe(
      map((transaction) => transaction.getKey(key)),
      mergeMap((request) => {

        /* Listening to the success event, and passing the item value if found, null otherwise */
        const success = (fromEvent(request, 'success') as Observable<Event>).pipe(
          map((event) => (event.target as IDBRequest).result),
          map((result) => (result !== undefined) ? true : false)
        );

        /* Merging success and errors events and autoclosing the observable */
        return (race(success, this.toErrorObservable(request, `has`)));
      }),
      first()
    );

  }

  /**
   * Connects to IndexedDB and creates the object store on first time
   */
  protected connect(prefix: string | null = null): void {

    let request: IDBOpenDBRequest;

    /* Connecting to IndexedDB */
    try {

      request = indexedDB.open(this.dbName);

    } catch (error) {

      /* Fallback storage if IndexedDb connection is failing */
      this.setFallback(prefix);

      return;

    }

    /* Listening the event fired on first connection, creating the object store for local storage */
    (fromEvent(request, 'upgradeneeded') as Observable<Event>)
      .pipe(first())
      .subscribe((event) => {

        /* Getting the database connection */
        const database = (event.target as IDBRequest).result as IDBDatabase;

        /* Checking if the object store already exists, to avoid error */
        if (!database.objectStoreNames.contains(this.objectStoreName)) {

          /* Creating the object store for local storage */
          database.createObjectStore(this.objectStoreName);

        }

      });

    /* Listening the success event and converting to an RxJS Observable */
    const success = fromEvent(request, 'success') as Observable<Event>;

    /* Merging success and errors events */
    (race(success, this.toErrorObservable(request, `connection`)) as Observable<Event>)
      .pipe(first())
      .subscribe((event) => {

        /* Storing the database connection for further access */
        this.database.next((event.target as IDBRequest).result as IDBDatabase);

      }, () => {

        /* Fallback storage if IndexedDb connection is failing */
        this.setFallback(prefix);

      });

  }

  /**
   * Opens an IndexedDB transaction and gets the local storage object store
   * @param mode Default to 'readonly' for read operations, or 'readwrite' for write operations
   * @returns An IndexedDB transaction object store, wrapped in an RxJS Observable
   */
  protected transaction(mode: 'readonly' | 'readwrite' = 'readonly'): Observable<IDBObjectStore> {

    /* From the IndexedDB connection, opening a transaction and getting the local storage objet store */
    return this.database
      .pipe(map((database) => database.transaction([this.objectStoreName], mode).objectStore(this.objectStoreName)));

  }

  /**
   * Transforms a IndexedDB success event in an RxJS Observable
   * @param request The request to listen
   * @returns A RxJS Observable with true value
   */
  protected toSuccessObservable(request: IDBRequest): Observable<boolean> {

    /* Transforming a IndexedDB success event in an RxJS Observable with true value */
    return (fromEvent(request, 'success') as Observable<Event>)
      .pipe(map(() => true));

  }

  /**
   * Transforms a IndexedDB error event in an RxJS ErrorObservable
   * @param request The request to listen
   * @param error Optionnal details about the error's origin
   * @returns A RxJS ErrorObservable
   */
  protected toErrorObservable(request: IDBRequest, error = ``): Observable<never> {

    /* Transforming a IndexedDB error event in an RxJS ErrorObservable */
    return (fromEvent(request, 'error') as Observable<Event>)
      .pipe(
        mergeMap(() => throwError(new Error(`IndexedDB ${error} issue : ${(request.error as DOMException).message}.`)))
      );

  }

  protected setFallback(prefix: string | null): void {
    this.fallback = new LocalStorageDatabase(prefix);
  }

}
