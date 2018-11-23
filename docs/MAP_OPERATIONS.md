# Advanced operations

Starting with version >= 7.1, in addition to the classic `localStorage`-like API,
this lib also provides a partial `Map`-like API for advanced operations.

## `.keys()` method

Gives you an `Observable` iterating over all the keys you stored:

```typescript
this.localStorage.keys().subscribe((key) => {

  console.log(key);

}, () => {}, () => {

  // If you need to something after the whole iteration,
  // be sure to act on complete, and not on success as usual,
  // as this Obserbable will emit several times, for each key

});
```

## `.has(key)` method

Gives you an `Observable` telling you if a key exists in storage:

```typescript
this.localStorage.has('someindex').subscribe((result) => {

  if (result) {
    console.log('The key exists :)');
  } else {
    console.log('The key does not exist :(');
  }

});
```

## `.size` property

Number of items stored in local storage.

```typescript
this.localStorage.size.subscribe((size) => {

  console.log(size);

});
```

## Other methods

`.values()` and `.entries` have not been implemented on purpose, because it would not be a good idea for performance.
But you can easily do your own implementation via `keys()`. 

## Recipes

As a convenience, below are some recipes for advanced operations asked by the community.

### Multiple stores

Let's say you stored:
- some app's data with such indexes: `app_data1`, `app_data2`...
- some user's data with such indexes: `user_data1`, `user_data2`...

You can then delete only app data:

```typescript
this.localStorage.keys().pipe(
  filter((key) => key.startsWith('app_')),
  mergeMap((key) => this.localStorage.removeItem(key))
).subscribe({ complete: () => {

  // Done

} });
```