import { Component, OnInit } from '@angular/core';
import { Observable, concat } from 'rxjs';
import { LocalStorage } from '@ngx-pwa/local-storage';

import { switchMap } from 'rxjs/operators';

interface Data {
  title: string;
}

@Component({
  selector: 'app-root',
  template: `
    <h1>{{(data$ | async)?.title}}</h1>
    <router-outlet></router-outlet>
    `
  // <iframe src="http://localhost:8080"></iframe>
})
export class AppComponent implements OnInit {

  title = 'LocalStorage';
  data$: Observable<Data | any[] | null> | null = null;

  constructor(private localStorage: LocalStorage) { }

  ngOnInit() {

    // const key = 'test';
    // const schema: JSONSchema = {
    //   properties: {
    //     title: {
    //       type: 'string'
    //     }
    //   }
    // };

    // this.data$ = this.localStorage.setItem(key, { title: this.title }).pipe(switchMap(() => this.localStorage.getItem(key, { schema })));
    concat(
      this.localStorage.setItem('key1', { key1: this.title }),
      this.localStorage.setItem('key2', { key2: this.title }),
      this.localStorage.setItem('key3', { key3: this.title }))
      .pipe(switchMap(() => this.localStorage.getAll())).subscribe(e => console.log(e));

  }

}
