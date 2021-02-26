// Импорт класса сетки
import Grid from './grid';
// Импорт классов тел
import BodyBullet from './body/bullet';
import BodyBounce from './body/bounce';
import BodyPlayer from './body/player';
import BodyStatic from './body/static';
// Импорт функций физического движка
import {
  updatePositions,
  removeBodies,
  detectCollisions,
  correctionPositions,
  afterUpdate
} from './engine';

class World {
  /**
   * Класс физического мира
   *
   * @param  {Object}  options               Объект с параметрами
   * @param  {Object}  options.bounds        Объект с координатами
   *                                         ограничивающего мир прямоугольника
   * @param  {Object}  options.bounds.min    Объект с координатами минимума
   * @param  {Number}  options.bounds.min.x  Координата минимума по оси X
   * @param  {Number}  options.bounds.min.y  Координата минимума по оси Y
   * @param  {Object}  options.bounds.max    Объект с координатами максимума
   * @param  {Number}  options.bounds.max.x  Координата максимума по оси X
   * @param  {Number}  options.bounds.max.y  Координата максимума по оси Y
   */
  constructor(options) {
    // Установка координат ограничивающего мир прямоугольника
    this.bounds = options.bounds || {
      min: { x: -Infinity, y: -Infinity },
      max: { x: Infinity, y: Infinity }
    };

    // Значение гравитации
    this.gravity = 0.001;

    // Массив с телами
    this.bodies = [];

    // Массив с телами для удаления
    this.bodiesToRemove = [];

    // Экземпляр класса сетки
    this.broadphase = new Grid();
  }

  /**
   * Паблик функция обновления физического мира
   * Сделано для нивелирования влияния частоты обновлений
   * на стабильность физического мира
   *
   * @param   {Number}  delta  Время прошедшее с предыдущего кадра
   * @return  {Array}          Массив с сенсорами текущего кадра
   */
  update(delta) {
    const maxDelta = 33;
    let stepsCount = Math.ceil(delta / maxDelta);

    let sensors = [];

    while(stepsCount--) {
      let stepDelta;
      if(delta < maxDelta) stepDelta = delta;
      else {
        stepDelta = maxDelta;
        delta -= maxDelta;
      }

      sensors = sensors.concat(this._update(stepDelta));
    }

    return sensors;
  }

  /**
   * Обновление физического мира
   *
   * @param   {Number}  delta  Время прошедшее с предыдущего кадра
   * @return  {Array}          Массив с сенсорами текущего кадра
   */
  _update(delta) {
    // Получение списка тел физического мира
    const bodies = this.bodies;
    // Получение списка тел для удаления
    const bodiesToRemove = this.bodiesToRemove;
    // Получение экземпляра класса сетки
    const broadphase = this.broadphase;

    // Массив сенсоров текущего обновления мира
    const sensors = [];
    // Массив для коллизий
    const collisions = [];

    // Обновление позиций, проверка нахождения тел за границами мира
    // и добавление их в список сенсоров
    updatePositions(delta, bodies, bodiesToRemove, this.bounds, sensors);

    // Удаление из физического мира тел из списка для удаления
    removeBodies(bodies, bodiesToRemove, broadphase);

    // Обновление пар возможных коллизий
    broadphase.update(bodies);
    const broadphasePairs = broadphase.pairs;

    // Проверка коллизий по парам возможных коллизий,
    // добавление пуль в списки для удаления и
    // добавление сенсоров в список сенсоров
    detectCollisions(broadphasePairs, bodiesToRemove, collisions, sensors);

    // Коррекция позиция объектов в зависимости от коллизий
    correctionPositions(collisions);

    // Вспомогательные действия после обновления физического мира
    afterUpdate(bodies);

    // Возвращаем список сенсоров текущего кадра
    return sensors;
  }

  /**
   * Удаление объекта из физического мира
   *
   * @param  {Body}  body  Экземпляр класса тела
   */
  removeBody(body) {
    // Добавление в массив обхектов для удаления
    this.bodiesToRemove.push(body);
  }

  /**
   * Создание тела пули
   *
   * @param   {Object}      options  Объект с параметрами тела
   * @return  {BodyBullet}           Экземпляр класса тела пули
   */
  createBulletBody(options) {
    const body = new BodyBullet(options);
    this.bodies.push(body);
    return body;
  }

  /**
   * Создание упругого тела
   *
   * @param   {Object}      options  Объект с параметрами тела
   * @return  {BodyBounce}           Экземпляр класса упругого тела
   */
  createBounceBody(options) {
    // Добавление в обхект с параметрами значения гравитации
    options.gravity = this.gravity;

    const body = new BodyBounce(options);
    this.bodies.push(body);
    return body;
  }

  /**
   * Создание тела игрока
   *
   * @param   {Object}      options  Объект с параметрами тела
   * @return  {BodyPlayer}           Экземпляр класса тела игрока
   */
  createPlayerBody(options) {
    // Добавление в обхект с параметрами значения гравитации
    options.gravity = this.gravity;

    const body = new BodyPlayer(options);
    this.bodies.push(body);
    return body;
  }

  /**
   * Создание статического тела
   *
   * @param   {Object}      options  Объект с параметрами тела
   * @return  {BodyStatic}           Экземпляр класса статического тела
   */
  createStaticBody(options) {
    const body = new BodyStatic(options);
    this.bodies.push(body);
    return body;
  }
}

export default World;
