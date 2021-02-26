var Phys = (function () {
  'use strict';

  /**
   * Идентификаторы типов тел
   *
   * @type  {Object}
   */
  const BODIES_TYPES = {
    // Статическое тело
    STATIC: 0,
    // Тело игрока
    PLAYER: 1,
    // Упругое тело
    BOUNCE: 2,
    // Тело пули
    BULLET: 3
  };

  /**
   * Ограничения количества коррекций столкновений упругого тела
   *
   * @type  {Object}
   */
  const BOUNCE_FIXES_LIMIT = {
    // По оси X
    X: 3,
    // По оси Y
    Y: 3
  };

  /**
   * Следующий уникальный идентификатор
   *
   * @type  {Number}
   */
  let nextId = 1;

  /**
   * Создает уникальный числовой идентификатор
   *
   * @return  {Number}  Идентификатор
   */
  const getNextId = () => {
    return nextId++;
  };

  /**
   * Значение сдвига для рассчета идентификаторов регионов
   * Размер региона = 2 в степени regionsShift
   *
   * @type  {Number}
   */
  const regionsShift = 9;

  /**
   * Расчет координат регионов для тела
   *
   * @param   {Object}  bounds  Объект с координатами обрамляющего тело
   *                            прямоугольника
   * @return  {Array}           Массив с идентификаторами регионов
   */
  const getRegions = bounds => {
    const regions = [];

    const sx = bounds.min.x >> regionsShift;
    const sy = bounds.min.y >> regionsShift;
    const ex = bounds.max.x >> regionsShift;
    const ey = bounds.max.y >> regionsShift;

    for(let y = sy; y <= ey; y++) {
      for(let x = sx; x <= ex; x++) {
        regions.push(x + ':' + y);
      }
    }

    return regions;
  };

  /**
   * Генерация идентификатора для пары тел
   *
   * @param   {Number}  bodyAId  Идентификатор первого тела
   * @param   {Number}  bodyBId  Идентификатор второго тела
   * @return  {String}           Строковый идентификатор
   */
  const getPairId = (bodyAId, bodyBId) => {
    return bodyAId < bodyBId
      ? bodyAId + ':' + bodyBId
      : bodyBId + ':' + bodyAId;
  };

  /**
   * Определяет возможно ли столкновение тел
   *
   * @param   {Body}     bodyA  Первое тело
   * @param   {Body}     bodyB  Второе тело
   * @return  {Boolean}         Результат
   */
  const canCollide = (bodyA, bodyB) => {
    // Сталкиваться не могут динаковые типы
    if(bodyA.type === bodyB.type) return false;

    // Упругие тела не могут сталкиваться с телами игроков и пулями
    // Но могут со статическими объектами
    if(bodyA.type === BODIES_TYPES.BOUNCE &&
       bodyB.type !== BODIES_TYPES.STATIC) return false;
    if(bodyB.type === BODIES_TYPES.BOUNCE &&
       bodyA.type !== BODIES_TYPES.STATIC) return false;

    // Пули не могут сталкиваться с телом владельца
    if(bodyA.type === BODIES_TYPES.BULLET &&
       bodyA.ownerId === bodyB.id) return false;
    if(bodyB.type === BODIES_TYPES.BULLET &&
       bodyB.ownerId === bodyA.id) return false;

    // Иначе могут сталкиваться
    return true;
  };

  /**
   * Хранилище пар объектов для расчета столкновений
   */
  class Grid {
    constructor() {
      // Список пар тел для проверки столкновений
      // Каждое свойство - идентификатор пары
      //        значение - объект с информацией о паре
      this.pairs = {};

      // Список хэшей
      // Каждое свойство - идентификатор региона
      //        значение - массив тел в этом регионе
      this.hash = {};
    }

    /**
     * Обновление регионов для тел физического мира
     *
     * @param  {Array}  bodies  Массив тел для обновления регионов
     */
    update(bodies) {
      for(let i = 0, l = bodies.length; i < l; i++) {
        const body = bodies[i];

        // Если у тела нет регионов, создаем и переходим к следующему,
        // так как регионы не меняются на текущий тик
        if(!body.regions) {
          this._addBody(body);
          continue;
        }

        // Статическое тело не изменяется
        if(body.type === BODIES_TYPES.STATIC) continue;

        // Если тело было обновлено
        if(body.isUpdated) {
          // Сбрасываем значение обновления
          if(body.type !== BODIES_TYPES.BULLET) body.isUpdated = false;

          // Получаем список регионов
          const regions = getRegions(body.bounds);
          const regionsString = regions.join(',');
          // Если старый список регионов не равен новому
          if(regionsString != body.regionsString) {
            // Обновляем пары для тела
            this._updateBody(body, regions, regionsString);
          }
        }
      }
    }

    /**
     * Добавление тела в список сетки и создание пар для проверки коллизий
     *
     * @param  {Body}  body  Тело для добавления
     */
    _addBody(body) {
      // Получение и установка списка регионов в свойство объекта
      const regions = getRegions(body.bounds);
      body.regions = regions;
      // Для не статических тел добавляем строковое представление списка регионов
      // Для ускорения проверки смены региона
      if(body.type !== BODIES_TYPES.STATIC) {
        body.regionsString = regions.join(',');
      }

      // Для каждого из регионов добавление объекта в хэш
      for(let i = 0, l = regions.length; i < l; i++) {
        const region = regions[i];
        // Если хэш есть, добавляем объект в массив тел
        if(this.hash[region]) this.hash[region].push(body);
        // Иначе содаем массив по хэшу
        else this.hash[region] = [ body ];
      }

      // Создание пар для проверки коллизий для объекта
      this._addPairs(body);
    }

    /**
     * Обновление регионов тела, обновление хэшей и списка коллизий
     *
     * @param  {Body}    body           Тело для обновления
     * @param  {Array}   newRegions     Массив идентификаторов новых регионов
     * @param  {String}  regionsString  Строковое представление
     *                                  списка идентификаторов регионов
     */
    _updateBody(body, newRegions, regionsString) {
      const oldRegions = body.regions;

      // Получение списка регионов для удаления
      // (регионов которые есть в старых и нет в новых)
      const regionsToRemove = oldRegions.filter(value => {
        return newRegions.indexOf(value) === -1;
      });
      // Получение списка регионов для добавления
      // (регионов которые есть в новых, но нет в старых)
      const regionsToAdd = newRegions.filter(value => {
        return oldRegions.indexOf(value) === -1;
      });

      // Если есть регионы для удаления
      if(regionsToRemove.length) {
        for(let i = 0, l = regionsToRemove.length; i < l; i++) {
          const region = regionsToRemove[i];
          const hash = this.hash[region];

          // Удаление из хэшей
          const index = hash.indexOf(body);
          if(index > -1) hash.splice(index, 1);
        }

        // Удаление из пар
        this._removePairs(body, regionsToRemove);
      }

      // Если есть регионы для добавления
      if(regionsToAdd.length) {
        for(let i = 0, l = regionsToAdd.length; i < l; i++) {
          const region = regionsToAdd[i];

          // Добавление тела в список хэшей новых регионов
          if(this.hash[region]) this.hash[region].push(body);
          else this.hash[region] = [ body ];
        }

        // Добавление в пары новых регионов
        this._addPairs(body, regionsToAdd);
      }

      // Устанвока телу списка новых регионов
      body.regions = newRegions;
      body.regionsString = regionsString;
    }

    /**
     * Удаление тела из хэшей и пар для проверки столкновений
     *
     * @param  {Body}  body  Тело для удаления
     */
    removeBody(body) {
      const regions = body.regions;
      if(!regions) return;

      for(let i = 0, l = regions.length; i < l; i++) {
        const region = regions[i];
        const hash = this.hash[region];
        if(!hash) continue;

        // Удаление тела из хэшей
        const index = hash.indexOf(body);
        if(index > -1) hash.splice(index, 1);
      }

      // Удаление тела из пар для проверки столкновений
      this._removePairs(body);
      // Удаление свойств регионов у тела
      delete(body.regions);
      delete(body.regionsString);
    }

    /**
     * Добавление тела в пары для проверки столкновений
     *
     * @param  {Body}   body       Тело для добавления
     * @param  {Array}  [regions]  Регионы для добавления
     */
    _addPairs(body, regions) {
      // Если передан параметр регионов для добавления,
      // использует их, иначе - регионы тела
      regions = regions || body.regions;

      for(let i = 0, iL = regions.length; i < iL; i++) {
        const region = regions[i];

        // Получение списка тел по хэшу
        const regionBodies = this.hash[region];
        for(let j = 0, jL = regionBodies.length; j < jL; j++) {
          const otherBody = regionBodies[j];
          // Если идентификаторы совпадают, переходим к следующему
          if(otherBody.id === body.id) continue;
          // Если тела не могут столкнуться, переходи к следующему
          if(!canCollide(body, otherBody)) continue;

          // Получение идентификатора пары тел
          const pairId = getPairId(body.id, otherBody.id);
          // Если пара есть, увеличиваем счетчик
          // Счетчик необходим для корректного перехода тела между регионами
          if(this.pairs[pairId]) this.pairs[pairId].count++;
          // Иначе добавляем объект пары
          else {
            this.pairs[pairId] = {
              id: pairId,
              bodyA: body,
              bodyB: otherBody,
              count: 1
            };
          }
        }
      }
    }

    /**
     * Удаление тела из пар для проверки столкновений
     *
     * @param  {Body}   body       Тело для удаления
     * @param  {Array}  [regions]  Регионы для удаления
     */
    _removePairs(body, regions) {
      // Если передан параметр регионов для удаления,
      // использует их, иначе - регионы тела
      regions = regions || body.regions;

      for(let i = 0, iL = regions.length; i < iL; i++) {
        const region = regions[i];

        // Получение списка тел по хэшу
        const regionBodies = this.hash[region];
        for(let j = 0, jL = regionBodies.length; j < jL; j++) {
          const otherBody = regionBodies[j];

          // Получение идентификатора пары тел
          const pairId = getPairId(body.id, otherBody.id);
          // Если есть пара с таким идентификатором
          if(this.pairs[pairId]) {
            // Если счетчик пары равен 1, удаляем ее
            if(this.pairs[pairId].count === 1) delete(this.pairs[pairId]);
            // Иначе уменьшаем счетчик на 1
            else this.pairs[pairId].count--;
          }
        }
      }
    }
  }

  /**
   * Класс тела пули
   */
  class BodyBullet {
    /**
     * Конструктор
     *
     * @param  {Object}  options             Объект с параметрами
     * @param  {Number}  options.x           Позиция по оси X
     * @param  {Number}  options.y           Позиция по оси Y
     * @param  {Object}  options.force       Вектор движения тела
     * @param  {Number}  options.force.x     Движения по оси X, пунктов/с
     * @param  {Number}  options.force.y     Движение по оси Y, пунктов/с
     * @param  {Number}  options.ownerId     Идентификатор тела владельца
     * @param  {Number}  options.longOfLife  Длинна жизни тела пули
     */
    constructor(options) {
      // Позиция объекта
      this.position = {
        x: options.x,
        y: options.y
      };
      // Позиция объекта на предыдущем кадре
      this.prevPosition = {
        x: options.x,
        y: options.y
      };
      // Направление движения
      // Делится на 1000, так как в параметрах приходит пунктов/с,
      // а необходимо пунктов/мс
      this.force = {
        x: options.force.x / 1000,
        y: options.force.y / 1000
      };

      // Идентификатор тела владельца пули
      // Для предовращения проверки столкновений тела владельца и тела пули
      this.ownerId = options.ownerId || 0;
      // Индикатор обновления постоянно в положительном состоянии
      // так как тело пули находится в постоянном движении
      this.isUpdated = true;

      // Длинна жизни пули
      // При продвижении на данную дистанцию, пуля уничтожается
      // Необходимо для ограничения полета осколков гранаты
      // TODO: пересмотреть логику с длинной жизни пули,
      //       есть подозрение, что совершаются лишние действия
      this.longOfLife = options.longOfLife || false;
      // Если есть свойство длинны жихни, устанавливаем свойство пройденной длинны
      if(options.longOfLife) this.long = 0;

      // Расчет коэффициентов уравления прямой пути тела пули
      // Уравнение прямой имеет вид: a*x + b*y + c = 0
      // где a = y1 - y2
      //     b = x2 - x1
      //     c = x1*y2 - x2*y1
      // Первая точка - позиция пули
      // Вторая точка - позиция + направление движения
      const coefs = {
        a: -this.force.y,
        b: this.force.x,
        c: options.x * this.force.y - options.y * this.force.x
      };
      // Установка в свойства тела коэффициентов для расчета точек пересечения
      // Формула расчета пересечения с прямой x = K:
      // y = - (a/b) * x - (c/b)
      // Формула расчета пересечения с прямой y = K:
      // x = - (b/a) * y - (c/b)
      this.equationCoefs = {
        ab: coefs.a / coefs.b,
        ba: coefs.b / coefs.a,
        ca: coefs.c / coefs.a,
        cb: coefs.c / coefs.b
      };

      // Уникальный числовой идентификатор
      this.id = getNextId();
      // Установка свойства типа объекта
      this.type = BODIES_TYPES.BULLET;
      // Свойство для хранения пользовательских данных
      this.userData = {};

      // Инициализация значения координат обрамляющего прямоугольника
      this.bounds = {
        min: { x: 0, y: 0 },
        max: { x: 0, y: 0 }
      };
      // Обновление координат обрамляющего прямоугольника
      this._updateBounds();
    }

    /**
     * Обновление тела
     *
     * @param  {Number}  delta           Время между предыдущим и текущим тиком
     * @param  {Array}   bodiesToRemove  Список обхектов для удаления
     */
    update(delta, bodiesToRemove) {
      const position = this.position;
      const prevPosition = this.prevPosition;
      const force = this.force;
      const longOfLife = this.longOfLife;

      // Установка предыдущей позиции
      prevPosition.x = position.x;
      prevPosition.y = position.y;

      // Установка новой текущей позиции
      const moveX = force.x * delta;
      const moveY = force.y * delta;
      position.x += moveX;
      position.y += moveY;

      // Если задана длинна жизни тела пули
      if(longOfLife !== false) {
        // Увеличиваем пройденную длинну
        this.long += Math.sqrt(moveX * moveX + moveY * moveY);

        // Если пройденная длинна больше длинны жизни
        if(this.long >= longOfLife) {
          // Добавляем в список для удаления
          bodiesToRemove.push(this);
          // Завершаем работу функции чтобы лишний раз не обновлять
          // обрамляющий прямоугольник
          return;
        }
      }

      // Обновление координат обрамляющего прямоугольника
      this._updateBounds();
    }

    /**
     * Обновляет координаты обрамляющего прямоугольника
     *
     * Зависят от текущей (this.position)
     * и предыдущей (this.prevPosition) позиций тела
     */
    _updateBounds() {
      const position = this.position;
      const prevPosition = this.prevPosition;
      const bounds = this.bounds;

      bounds.min.x = Math.min(position.x, prevPosition.x);
      bounds.min.y = Math.min(position.y, prevPosition.y);
      bounds.max.x = Math.max(position.x, prevPosition.x);
      bounds.max.y = Math.max(position.y, prevPosition.y);
    }
  }

  /**
   * Класс упругого тела
   */
  class BodyBounce {
    /**
     * Конструктор
     *
     * @param  {Object}  options          Объект с параметрами
     * @param  {Number}  options.x        Позиция по оси X
     * @param  {Number}  options.y        Позиция по оси Y
     * @param  {Number}  options.width    Ширина
     * @param  {Number}  options.height   Высота
     * @param  {Object}  options.force    Вектор движения тела
     * @param  {Number}  options.force.x  Движения по оси X, пунктов/с
     * @param  {Number}  options.force.y  Движение по оси Y, пунктов/с
     * @param  {Number}  options.gravity  Значение гравитации физического мира
     */
    constructor(options) {
      // Позиция объекта
      this.position = {
        x: options.x,
        y: options.y
      };
      // Размеры объекта
      this.size = {
        width: options.width,
        height: options.height
      };
      // Направление движения
      // Делится на 1000, так как в параметрах приходит пунктов/с,
      // а необходимо пунктов/мс
      this.force = {
        x: options.force.x / 1000,
        y: options.force.y / 1000
      };
      // Значение гравитации
      this.gravity = options.gravity;

      // Скорость отскока по оси Y
      // Меняется знак,
      // так как отскок происходит в отрицательном направлении оси Y
      this.reboundSpeed = this.force.y > 0 ? -this.force.y : this.force.y;
      // Индикатор [-1, 0, 1] перемещения тела по оси Y на текущем кадре
      // Необходимо для корректировки позиции при коллизии
      this.moveDirectionY = 0;
      // Статус обновления позиции или размеров на текущем тике
      this.isUpdated = false;


      this.countCollisionsFix = {
        x: 0,
        y: 0
      };

      // Уникальный числовой идентификатор
      this.id = getNextId();
      // Установка свойства типа объекта
      this.type = BODIES_TYPES.BOUNCE;
      // Свойство для хранения пользовательских данных
      this.userData = {};

      // Расчет половинных значений ширины и высоты
      const halfWidth = options.width / 2;
      const halfHeight = options.height / 2;
      // Расчет значений нормализованных (приведенных к началу координат)
      // координат обрамляющего прямоугольника
      this.normalBounds = {
        min: {
          x: -halfWidth,
          y: -halfHeight
        },
        max: {
          x: halfWidth,
          y: halfHeight
        }
      };
      // Инициализация значения координат обрамляющего прямоугольника
      this.bounds = {
        min: { x: 0, y: 0 },
        max: { x: 0, y: 0 }
      };
      // Обновление координат обрамляющего прямоугольника
      this._updateBounds();
    }

    /**
     * Установка позиции телу игрока
     *
     * @param  {Object}  position    Объект с координатами
     * @param  {Number}  position.x  Координата по оси X
     * @param  {Number}  position.y  Координата по оси Y
     */
    setPosition(position) {
      // Установка позиции
      this.position.x = position.x;
      this.position.y = position.y;

      // Установка свойства обновления тела
      this.isUpdated = true;
      // Обновлять координаты обрамляющего прямоугольника не нужно,
      // так как это будет сделано в следующий тик в методе update
    }

    /**
     * Обновление тела
     * ВАЖНО: текущий вариант не учитывает возможность разрушения платформы
     * под упругим телом и применение гравитации, в случае добавления
     * стоительства, необходимо переписать метод update
     *
     * @param  {Number}  delta  Время между предыдущим и текущим тиком
     */
    update(delta) {
      // Если не достигнут лимит исправлений по оси X
      if(this.countCollisionsFix.x < BOUNCE_FIXES_LIMIT.X) {
        // Изменяем позицию по оси X
        this.position.x += this.force.x * delta;

        // Устанавливаем свойство индикатора обновления
        this.isUpdated = true;
      }

      // Если не достигнут лимит исправлений по оси Y
      if(this.countCollisionsFix.y < BOUNCE_FIXES_LIMIT.Y) {
        // Изменяем позицию по оси Y
        this.position.y += this.force.y * delta;
        // Изменяем направление движения с учетом гравитации
        this.force.y += this.gravity * delta;

        // Устанавливаем индикатор перемещения тела по оси Y
        this.moveDirectionY = this.force.y > 0 ? 1 : -1;
        // Устанавливаем свойство индикатора обновления
        this.isUpdated = true;
      }

      // Обновляем координаты вершин и обрамляющего прямоугольника
      // если есть обновление
      if(this.isUpdated) this._updateBounds();
    }

    /**
     * Обновление тела после столкновения
     *
     * @param  {Object}  correction    Вектор корректировки позиции
     * @param  {Number}  correction.x  Корректировка по оси X
     * @param  {Number}  correction.y  Корректировка по оси Y
     */
    updateCollision(correction) {
      // Если количество исправлений по оси X меньше или равно лимиту
      if(this.countCollisionsFix.x <= BOUNCE_FIXES_LIMIT.X) {
        // Если количество исправлений по оси X равно лимиту
        if(this.countCollisionsFix.x === BOUNCE_FIXES_LIMIT.X) {
          // Отключаем перемещение по оси X
          this.force.x = 0;
        }
        // Иначе
        else {
          // При любом столкновении уменьшаем скорость по оси X
          this.force.x *= 0.5 - 0.1 * this.countCollisionsFix.x;

          // Если столкновение сбоку и не с той стороны в которую движется тело
          if(correction.x != 0 &&
             Math.sign(correction.x) != Math.sign(this.force.x)) {
            // Меняем направлеие движения по оси X
            this.force.x *= -1;
          }

          // Увеличиваем счетчик количества осправлений по оси X
          this.countCollisionsFix.x++;
        }
      }

      // Если есть столкновение по оси Y
      // и количество исправлений по оси Y меньше или равно лимиту
      if(correction.y !== 0 &&
         this.countCollisionsFix.y <= BOUNCE_FIXES_LIMIT.Y) {
        // Если столкновение снизу
        if(correction.y < 0) {
          // Если количество исправлений по оси Y равно лимиту
          if(this.countCollisionsFix.y === BOUNCE_FIXES_LIMIT.Y) {
            // Отключаем перемещение по оси Y
            this.force.y = 0;
            // Сбрасываем индикатор перемещения тела по оси Y
            this.moveDirectionY = 0;
          }
          // Иначе
          else {
            // Уменьшаем скорость отскока
            this.reboundSpeed *= 0.5 - 0.15 * this.countCollisionsFix.y;
            // Устанавливаем направление движения в скорость отскока
            this.force.y = this.reboundSpeed;

            // Увеличиваем счетчик количества осправлений по оси Y
            this.countCollisionsFix.y++;
          }
        }

        // Если столкновение сверху, меняем направление по оси Y
        if(correction.y > 0) this.force.y *= -1;
      }
    }

    /**
     * Обновляет координаты обрамляющего прямоугольника
     *
     * Зависят от нормализованных координат обрамляющего прямоугольника
     * (this.normalBounds) и позиции (this.position)
     */
    _updateBounds() {
      const normalBounds = this.normalBounds;
      const position = this.position;
      const bounds = this.bounds;

      bounds.min.x = normalBounds.min.x + position.x;
      bounds.min.y = normalBounds.min.y + position.y;
      bounds.max.x = normalBounds.max.x + position.x;
      bounds.max.y = normalBounds.max.y + position.y;
    }
  }

  /**
   * Класс тела игрока
   */
  class BodyPlayer {
    /**
     * Конструктор
     *
     * @param  {Object}  options               Объект с параметрами
     * @param  {Number}  options.x             Позиция по оси X
     * @param  {Number}  options.y             Позиция по оси Y
     * @param  {Number}  options.width         Ширина объекта
     * @param  {Number}  options.height        Высота объекта
     * @param  {Number}  options.moveSpeed     Скорость движения по оси X
     * @param  {Number}  options.jumpDistance  Высота прыжка
     * @param  {Number}  options.gravity       Значение гравитации
     *                                         физического мира
     */
    constructor(options) {
      // Позиция объекта
      this.position = {
        x: options.x,
        y: options.y
      };
      // Размеры объекта
      this.size = {
        width: options.width,
        height: options.height
      };
      // Скорость горизонтального перемещения
      // Переданное в параметрах значение делится на 1000,
      // так как передается в единицах в секунду
      this.moveSpeed = options.moveSpeed
        ? options.moveSpeed / 1000
        : 0.4;
      // Высота прыжка
      this.jumpDistance = options.jumpDistance || options.height * 1.1;
      // Значение гравитации
      this.gravity = options.gravity;
      // Коэффициент для расчета расстояния в прыжке
      this.jumpCoef = Math.sqrt(this.jumpDistance / this.gravity);

      // Последняя позиция нахождения на земле по оси Y до прыжка или падения
      this.lastGroundPositionY = options.y || 0;
      // Направление движения тела по горизонтали
      this.forceX = 0;
      // Индикатор [-1, 0, 1] перемещения тела по оси Y на текущем кадре
      // Необходимо для корректировки позиции при коллизии
      this.moveDirectionY = 0;
      // Статус нахождения на платформе
      this.isOnGround = false;
      // Индикатор изначального горизонтального направления при прыжке
      this.jumpInitDir = 0;
      // Статус обновления позиции или размеров на текущем тике
      this.isUpdated = false;

      // Таймер прыжка
      this.jumpTimer = false;
      // Таймер падения для корректного расчета позиции
      this.fallTimer = false;

      // Уникальный числовой идентификатор
      this.id = getNextId();
      // Установка свойства типа объекта
      this.type = BODIES_TYPES.PLAYER;
      // Свойство для хранения пользовательских данных
      this.userData = {};

      // Расчет половинных значений ширины и высоты
      const halfWidth = options.width / 2;
      const halfHeight = options.height / 2;
      // Расчет значений нормализованных (приведенных к началу координат)
      // координат обрамляющего прямоугольника
      this.normalBounds = {
        min: {
          x: -halfWidth,
          y: -halfHeight
        },
        max: {
          x: halfWidth,
          y: halfHeight
        }
      };
      // Инициализация значения координат обрамляющего прямоугольника
      this.bounds = {
        min: { x: 0, y: 0 },
        max: { x: 0, y: 0 },
      };
      // Обновление координат обрамляющего прямоугольника
      this._updateBounds();
    }

    /**
     * Установка позиции телу игрока
     *
     * @param  {Object}  position    Объект с координатами
     * @param  {Number}  position.x  Координата по оси X
     * @param  {Number}  position.y  Координата по оси Y
     */
    setPosition(newPosition) {
      // Установка позиции
      const position = this.position;
      position.x = newPosition.x;
      position.y = newPosition.y;

      // Установка свойства обновления тела
      this.isUpdated = true;
      // Обновлять координаты обрамляющего прямоугольника не нужно,
      // так как это будет сделано в следующий тик в методе update
    }

    /**
     * Обновление тела
     *
     * @param  {Number}  delta  Время между предыдущим и текущим тиком
     */
    update(delta) {
      // Если есть направление движения по оси X
      if(this.forceX) {
        // Устанавливаем свойство индикатора обновления
        this.isUpdated = true;

        // Устанавливаем позицию по оси X
        // в зависимости от направления движения
        this.position.x += this.forceX * delta;

        // Если тело на земле
        if(this.isOnGround) {
          // Сбрасываем направление движения по оси X
          //this.forceX = 0;

          // ВАЖНО: не учитывает разрушаемость платформ под игроком
          // Закомментировать в случае добавления строительства
          //
          // Добавляем к позиции Y +1 для подтверждения нахождения на земле
          this.position.y += 1;
          // Сбрасываем значение свойства нахождения на платформе
          this.isOnGround = false;
        }
      }

      // Сбрасываем индикатор движения по оси Y
      this.moveDirectionY = 0;

      // Если запущен таймер прыжка
      if(this.jumpTimer !== false) {
        // Расстояние прыжка (по оси Y) вычисляется по формуле a * (x - c)^2 - b
        // где x - время с начала прыжка
        //     a - значение гравитации
        //     b - высота прыжка
        //     с - квадратный корень из отношения высоты прыжка к гравитации,
        //         необходим для создания пересечения паработы и центра координат

        // Добавляем дельту к таймеру прыжка
        this.jumpTimer += delta;

        // Добавляет расстояние к последней позиции на земле по оси Y
        this.position.y = this.lastGroundPositionY
          + this.gravity * Math.pow(this.jumpTimer - this.jumpCoef, 2)
          - this.jumpDistance;

        // Устанавливаем индикатор движения по оси Y
        this.moveDirectionY = this.jumpTimer - this.jumpCoef > 0 ? 1 : -1;

        // Устанавливаем свойство индикатора обновления
        this.isUpdated = true;
      }

      // Если тело не на земле и таймер прыжка не запущен,
      // то тело в состоянии падения
      if(!this.isOnGround && this.fallTimer !== false) {
        // Расстояние падения (по оси Y) вычисляется по формуле a * x^2
        // где x - время с начала падения
        //     a - значение гравитации

        // Добавляем дельту к таймеру падения
        this.fallTimer += delta;

        // Добавляет расстояние к последней позиции на земле по оси Y
        this.position.y = this.lastGroundPositionY
                        + this.gravity * Math.pow(this.fallTimer, 2);

        // Устанавливаем индикатор движения по оси Y
        this.moveDirectionY = 1;

        // Устанавливаем свойство индикатора обновления
        this.isUpdated = true;
      }

      // ВАЖНО: учитывает разрушаемость платформ под игроком
      // Раскомментировать в случае добавления строительства
      //
      // Добавляем к позиции Y +1 для подтверждения нахождения на земле
      //if(this.isOnGround) this.position.y += 1;
      // Сбрасываем значение свойства нахождения на платформе
      //this.isOnGround = false;

      // Обновляем координаты вершин и обрамляющего прямоугольника
      // если есть обновление
      if(this.isUpdated) this._updateBounds();
    }

    /**
     * Обновление тела после столкновения
     *
     * @param  {Object}  correction    Вектор корректировки позиции
     * @param  {Number}  correction.x  Корректировка по оси X
     * @param  {Number}  correction.y  Корректировка по оси Y
     */
    updateCollision(correction) {
      // Если есть пересечение по оси X
      if(correction.x != 0) {
        // Сбрасываем значение направления прыжка и движения по оси X
        this.jumpInitDir = 0;
        //this.forceX = 0;
      }

      // Столкновение нижней стороной
      if(correction.y < 0) {
        // Установка статуса "на земле"
        this.isOnGround = true;
        // Сброс значения направления прыжка
        this.jumpInitDir = 0;
        // Сброс таймеров прыжка и падения
        this.jumpTimer = false;
        this.fallTimer = false;
        // Сброс двжиения по оси X
        //this.forceX = 0;
      }

      // Столкновение верхней стороной
      if(correction.y > 0) {
        // Отключение таймера прыжка
        this.jumpTimer = false;
        // Сброс значения направления прыжка
        this.jumpInitDir = 0;
      }
    }

    /**
     * Движение тела игрока
     *
     * @param  {Number}  dir  Направление движения
     *                        -1 = движение влево
     *                        1 = движение вправо
     */
    move(dir) {
      // Устанавливаем скорость горизонтального движения
      this.forceX = this.moveSpeed * dir;

      // Если тело не на земле
      // и направление не равно изначальному напрвлению прыжка
      if(!this.isOnGround && dir != this.jumpInitDir) {
        // Сбрасываем значение изначального направления прыжка
        this.jumpInitDir = 0;
        // Снижаем скорость горизонтального движения в 2 раза
        this.forceX /= 2;
      }
    }

    stop() {
      this.forceX = 0;
    }

    /**
     * Прыжок тела игрока
     */
    jump() {
      // Если тело не на земле, ничего не делаем
      if(!this.isOnGround) return;

      // Устанавливаем таймер прыжка в значение 0
      this.jumpTimer = 0;
      // Устанавливаем текущую позицию оси Y
      // в значение последней позиции на земле по оси Y
      this.lastGroundPositionY = this.position.y;

      // В зависимости от текущего направления движения
      // устанавливаем значение изначального направления прыжка
      if(this.forceX < 0) this.jumpInitDir = -1;
      if(this.forceX > 0) this.jumpInitDir = 1;

      this.isOnGround = false;
    }

    /**
     * Обновляет координаты обрамляющего прямоугольника
     *
     * Зависят от нормализованных координат обрамляющего прямоугольника
     * (this.normalBounds) и позиции (this.position)
     */
    _updateBounds() {
      const normalBounds = this.normalBounds;
      const position = this.position;
      const bounds = this.bounds;

      bounds.min.x = normalBounds.min.x + position.x;
      bounds.min.y = normalBounds.min.y + position.y;
      bounds.max.x = normalBounds.max.x + position.x;
      bounds.max.y = normalBounds.max.y + position.y;
    }
  }

  /**
   * Класс статического тела
   */
  class BodyStatic {
    /**
     * Конструктор
     *
     * @param  {Object}   options           Объект с параметрами
     * @param  {Number}   options.x         Позиция по оси X
     * @param  {Number}   options.y         Позиция по оси Y
     * @param  {Number}   options.width     Ширина
     * @param  {Number}   options.height    Высота
     * @param  {Boolean}  options.isSensor  Является ли тело сенсором
     */
    constructor(options) {
      // Позиция
      this.position = {
        x: options.x,
        y: options.y
      };
      // Размеры
      this.size = {
        width: options.width,
        height: options.height
      };
      // Индикатор является ли тело сенсором
      this.isSensor = options.isSensor ? true : false;

      // Уникальный числовой идентификатор
      this.id = getNextId();
      // Установка свойства типа объекта
      this.type = BODIES_TYPES.STATIC;
      // Свойство для хранения пользовательских данных
      this.userData = {};

      // Расчет половинных значений ширины и высоты
      const halfWidth = options.width / 2;
      const halfHeight = options.height / 2;
      // Расчет координат обрамляющего тело прямоугольника
      this.bounds = {
        min: {
          x: -halfWidth + options.x,
          y: -halfHeight + options.y
        },
        max: {
          x: halfWidth + options.x,
          y: halfHeight + options.y
        },
      };
    }
  }

  /**
   * Проверка нахождения точки за регионом
   *
   * @param   {Object}   vector        Координаты точки
   * @param   {Number}   vector.x      Значение координаты по оси X
   * @param   {Number}   vector.y      Значение координаты по оси Y
   * @param   {Object}   bounds        Объект с координатами региона
   * @param   {Object}   bounds.min    Объект с координатами минимума
   * @param   {Number}   bounds.min.x  Координата минимума по оси X
   * @param   {Number}   bounds.min.y  Координата минимума по оси Y
   * @param   {Object}   bounds.max    Объект с координатами максимума
   * @param   {Number}   bounds.max.x  Координата максимума по оси X
   * @param   {Number}   bounds.max.y  Координата максимума по оси Y
   * @return  {Boolean}                Находится ли точка за регионом
   */
  const isOutOfRegion = (vector, bounds) => {
    return vector.x < bounds.min.x ||
           vector.x > bounds.max.x ||
           vector.y < bounds.min.y ||
           vector.y > bounds.max.y;
  };

  /**
   * Получение ширины и высоты прямоугольника пересечения двух регионов
   *
   * @param   {Object}  boundsA        Объект с координатами первого региона
   * @param   {Object}  boundsA.min    Объект с координатами минимума
   * @param   {Number}  boundsA.min.x  Координата минимума по оси X
   * @param   {Number}  boundsA.min.y  Координата минимума по оси Y
   * @param   {Object}  boundsA.max    Объект с координатами максимума
   * @param   {Number}  boundsA.max.x  Координата максимума по оси X
   * @param   {Number}  boundsA.max.y  Координата максимума по оси Y
   * @param   {Object}  boundsB        Объект с координатами второго региона
   * @param   {Object}  boundsB.min    Объект с координатами минимума
   * @param   {Number}  boundsB.min.x  Координата минимума по оси X
   * @param   {Number}  boundsB.min.y  Координата минимума по оси Y
   * @param   {Object}  boundsB.max    Объект с координатами максимума
   * @param   {Number}  boundsB.max.x  Координата максимума по оси X
   * @param   {Number}  boundsB.max.y  Координата максимума по оси Y
   * @return  {Object}                 Объект с шириной и высотой прямоугольника
   *                                   пересечения
   */
  const getIntersection = (boundsA, boundsB) => {
    const maxMinX = Math.max(boundsA.min.x, boundsB.min.x);
    const minMaxX = Math.min(boundsA.max.x, boundsB.max.x);

    const maxMinY = Math.max(boundsA.min.y, boundsB.min.y);
    const minMaxY = Math.min(boundsA.max.y, boundsB.max.y);

    // Ширина и высота прямоугольника пересечения могут быть отрицательными
    // В этом случае пересечение отсутствует
    return {
      width: minMaxX - maxMinX,
      height: minMaxY - maxMinY
    };
  };

  /**
   * Обработка пересечения линий
   * Сравнение расстройний с текущим результатом,
   * если меньше, изменения текущего результата
   *
   * @param  {Number}  input            Входное значение
   * @param  {Number}  a                Первый коэффициент
   * @param  {Number}  b                Второй коэффициент
   * @param  {Number}  minOutputValue   Минимум выходного значения
   * @param  {Number}  maxOutputValue   Максимум выходного значения
   * @param  {Number}  prevInput        Пердыдущее значение входного значения
   * @param  {Number}  prevOutput       Пердыдущее значение выходного значения
   * @param  {String}  inputAxis        Ось входного значения
   * @param  {String}  outputAxis       Ось выходного значения
   * @param  {Body}    target           Тело столкновения с пулей
   * @param  {Object}  result           Объект с информацией о текущем результате
   * @param  {Object}  result.point     Объект с координатами точки пересечения
   * @param  {Number}  result.point.x   Координата точки пересечения по оси X
   * @param  {Number}  result.point.y   Координата точки пересечения по оси Y
   * @param  {Number}  result.halfSumm  Расстояние текущего результата
   * @param  {Body}    result.target    Тело столкновения с пулей текущего
   *                                    результата
   */
  const handlingLineIntersect = (
    input, a, b,
    minOutputValue, maxOutputValue,
    prevInput, prevOutput,
    inputAxis, outputAxis,
    target, result
  ) => {
    // Если один из коэффициентов равен бесконечности, ничего не делаем
    // Ситуация возникает в случае горизонтально или вертикально двигающейся пули
    if(!isFinite(a) || !isFinite(b)) return;

    // Расчет выходного значения
    var output = -a * input - b;
    // Если выходное значение за границами, ничего не делаем
    if(output <= minOutputValue || output >= maxOutputValue) return;

    // Считаем расстояние (полусумму сторон)
    var halfSumm = Math.abs(output - prevOutput) + Math.abs(input - prevInput);

    // Если полусумма меньше полусуммы текущего результата
    if(halfSumm < result.halfSumm) {
      // Установка значений по осям
      result.point[inputAxis] = input;
      result.point[outputAxis] = output;
      // Установка полусуммы
      result.halfSumm = halfSumm;
      // Установка объекта столкновения с телом пули
      result.target = target;
    }
  };

  /**
   * Обновление позиций тел, проверка нахождения тел за границами мира
   * и добавление их в список сенсоров
   *
   * @param  {Number}  delta              Время с между текущим
   *                                      и предыдущим кадрами
   * @param  {Array}   bodies             Список тел физического мира
   * @param  {Array}   bodiesToRemove     Список тел для удаления
   *                                      из физического мира
   * @param  {Object}  worldBounds        Границы физического мира
   * @param  {Object}  worldBounds.min    Объект с координатами минимума
   * @param  {Number}  worldBounds.min.x  Координата минимума по оси X
   * @param  {Number}  worldBounds.min.y  Координата минимума по оси Y
   * @param  {Object}  worldBounds.max    Объект с координатами максимума
   * @param  {Number}  worldBounds.max.x  Координата максимума по оси X
   * @param  {Number}  worldBounds.max.y  Координата максимума по оси Y
   * @param  {Array}   sensors            Список сенсоров текущего кадра
   */
  const updatePositions = (
    delta, bodies, bodiesToRemove, worldBounds, sensors
  ) => {
    // Проходим по всем телам
    for(let i = 0, l = bodies.length; i < l; i++) {
      const body = bodies[i];

      // Статические тела не нужно обновлять
      if(body.type === BODIES_TYPES.STATIC) continue;
      // Тела из списка удаления не нужно обновлять
      if(bodiesToRemove.indexOf(body) > -1) continue;

      // Обновление состояния тела
      body.update(delta, bodiesToRemove);

      // Проверка на нахождение позиции объекта за границами мира
      if(isOutOfRegion(body.position, worldBounds)) {
        // Добавление в список удаления
        bodiesToRemove.push(body);
        // Добавление в список сенсоров
        sensors.push({
          isOutWorld: true,
          body: body
        });
      }
    }
  };

  /**
   * Удаление из физического мира тел из списка для удаления
   *
   * @param  {Array}  bodies          Список тел физического мира
   * @param  {Array}  bodiesToRemove  Список тел для удаления из физического мира
   * @param  {Grid}   broadphase      Экземпляр класса сетки
   */
  const removeBodies = (bodies, bodiesToRemove, broadphase) => {
    // Удаление тел из списка для удаления
    for(let i = 0, l = bodiesToRemove.length; i < l; i++) {
      // Удаление тела из сетки
      broadphase.removeBody(bodiesToRemove[i]);

      // Удаление тела из массива тел физического мира
      const index = bodies.indexOf(bodiesToRemove[i]);
      if(index > -1) bodies.splice(index, 1);
    }

    // Очистка массива тел для удаления
    // В том числе очистка в свойстве экземпляра мира
    bodiesToRemove.length = 0;
  };

  /**
   * Проверка коллизий по парам возможных коллизий,
   * добавление сенсоров в список сенсоров
   *
   * @param  {Object}  broadphasePairs  Пары позможны коллизий
   * @param  {Array}   bodiesToRemove   Список тел для удаления
   *                                    из физического мира
   * @param  {Array}   collisions       Список коллизий текущего кадра
   * @param  {Array}   sensors          Список сенсоров текущего кадра
   */
  const detectCollisions = (
    broadphasePairs, bodiesToRemove, collisions, sensors
  ) => {
    // Объект для хранения списков попаданий пуль
    const bulletsTargets = {};

    // Проходим по парам для проверки коллизии
    for(let pairId in broadphasePairs) {
      // Получение тел пары
      const pair = broadphasePairs[pairId];
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      // Получение прямоугольника пересечения
      const intersection = getIntersection(bodyA.bounds, bodyB.bounds);

      // Если ширина или высота прямоугольника пересечения
      // отрицательные, ничего не делаем
      if(intersection.width < 0 || intersection.height < 0) continue;

      // Если одно из тел сенсор, добавляем в список сенсоров
      if(bodyA.isSensor || bodyB.isSensor) {
        sensors.push({
          bodyA: bodyA,
          bodyB: bodyB
        });

        // Завершаем итерацию
        continue;
      }

      // Если один из объектов - пуля
      if(bodyA.type === BODIES_TYPES.BULLET ||
         bodyB.type === BODIES_TYPES.BULLET) {
        const bodyBullet = bodyA.type === BODIES_TYPES.BULLET ? bodyA : bodyB;
        const bodyHitted = bodyA.type === BODIES_TYPES.BULLET ? bodyB : bodyA;

        // Если пули нет в списке попаданий пуль, создаем
        if(!bulletsTargets[bodyBullet.id]) {
          bulletsTargets[bodyBullet.id] = {
            bullet: bodyBullet,
            targets: []
          };
        }
        // Добавление тела в которое попали в список попаданий тела пули
        bulletsTargets[bodyBullet.id].targets.push(bodyHitted);

        // Завершаем итерацию
        continue;
      }

      // Добавляем в список коллизий
      collisions.push({
        bodyA: bodyA,
        bodyB: bodyB,
        intersection: intersection
      });
    }

    // Проходим по списку целей пуль
    for(let bulletId in bulletsTargets) {
      // Получение тела пули и списка тел столкновения с ней
      const bullet = bulletsTargets[bulletId].bullet;
      const bulletTargets = bulletsTargets[bulletId].targets;

      // Объект для хранения данных о первом пересечении
      // Первое пересечение - максимально близкое к предыдущей позиции тела пули
      const hitResult = {
        // Минимальная (наиболле близкая к предыдущей позиции тела пули)
        // точка пересечения
        point: { x: 0, y: 0 },
        // Полусумма сторон прямоугольника (сумма катетов)
        // 1) проще расчитывать, чем длинну диагонали (гипотенузы)
        // 2) значение расстояния до точки пересечения
        //    в дальнейшем не используется
        halfSumm: Infinity,
        // Цель попадания
        target: null
      };

      // Проходим по телам столкновения с пулей
      for(let i = 0, l = bulletTargets.length; i < l; i++) {
        const target = bulletTargets[i];

        // Проверка пересечения с минимальным значением по оси X
        handlingLineIntersect(
          target.bounds.min.x, bullet.equationCoefs.ab, bullet.equationCoefs.cb,
          target.bounds.min.y, target.bounds.max.y,
          bullet.prevPosition.x, bullet.prevPosition.y,
          'x', 'y',
          target, hitResult
        );

        // Проверка пересечения с максимальным значением по оси X
        handlingLineIntersect(
          target.bounds.max.x, bullet.equationCoefs.ab, bullet.equationCoefs.cb,
          target.bounds.min.y, target.bounds.max.y,
          bullet.prevPosition.x, bullet.prevPosition.y,
          'x', 'y',
          target, hitResult
        );

        // Проверка пересечения с минимальным значением по оси Y
        handlingLineIntersect(
          target.bounds.min.y, bullet.equationCoefs.ba, bullet.equationCoefs.ca,
          target.bounds.min.x, target.bounds.max.x,
          bullet.prevPosition.y, bullet.prevPosition.x,
          'y', 'x',
          target, hitResult
        );

        // Проверка пересечения с максимальным значением по оси Y
        handlingLineIntersect(
          target.bounds.max.y, bullet.equationCoefs.ba, bullet.equationCoefs.ca,
          target.bounds.min.x, target.bounds.max.x,
          bullet.prevPosition.y, bullet.prevPosition.x,
          'y', 'x',
          target, hitResult
        );
      }

      // Если не указана цель, значит столкновений нет
      if(hitResult.target === null) continue;

      // Если у пули нет длинны жизни или она попала в статический объект
      // добавляем пулю в список для удаления
      if(bullet.longOfLife === false ||
         hitResult.target.type === BODIES_TYPES.STATIC) {
        bodiesToRemove.push(bullet);
      }

      // Добавляем в список сенсоров
      sensors.push({
        isHit: true,
        bodyBullet: bullet,
        bodyHitted: hitResult.target,
        point: hitResult.point
      });
    }
  };

  /**
   * Коррекция позиция объектов в зависимости от коллизий
   *
   * @param  {Array}  collisions  Список коллизий текущего кадра
   */
  const correctionPositions = collisions => {
    // Проходим по все коллизиям
    for(let i = 0, l = collisions.length; i < l; i++) {
      const collision = collisions[i];

      // Получаем объекты тел столкновений
      const bodyA = collision.bodyA;
      const bodyB = collision.bodyB;

      // В восстановление позиций попадают такие пары тел:
      // - игрок и статическое тело
      // - упругое тело и статическое тело
      // В переменную resolvedBody записываем тело игрока или упругое тело
      let resolvedBody;
      let staticBody;
      if(bodyA.type === BODIES_TYPES.PLAYER ||
         bodyA.type === BODIES_TYPES.BOUNCE) {
        resolvedBody = bodyA;
        staticBody = bodyB;
      } else {
        resolvedBody = bodyB;
        staticBody = bodyA;
      }

      // Получаем пересечение
      const correction = {
        x: collision.intersection.width,
        y: collision.intersection.height
      };

      // Свойство необходимости применения стандартного
      // исправления по меньшему пересечению
      let needMinIntersectFix = true;

      // Получаем ограничивающие прямоугольники тел
      const boundsResolved = resolvedBody.bounds;
      const boundsStatic = staticBody.bounds;
      // Не учитывается пересечение по оси X
      // если левая и правая стороны тела для восстановления позиции
      // находятся между левой и правой сторонами статического тела
      if(boundsResolved.min.x > boundsStatic.min.x &&
         boundsResolved.max.x < boundsStatic.max.x) {
        correction.x = 0;
        needMinIntersectFix = false;
      }
      // Не учитывается пересечение по оси Y
      // если верхняя и нижняя стороны тела для восстановления позиции
      // находятся между верхней и нижней сторонами статического тела
      if(boundsResolved.min.y > boundsStatic.min.y &&
         boundsResolved.max.y < boundsStatic.max.y) {
        correction.y = 0;
        needMinIntersectFix = false;
      }

      // Если есть пересечение по оси Y
      // и тело для восстановления позиции находится над статическим телом
      if(correction.y !== 0 && resolvedBody.position.y < staticBody.position.y) {
        // Если тело для восстановления - тело игрока
        // и тело для восстановления движется вверх
        // и тело для восстановления не на земле
        if(resolvedBody.type === BODIES_TYPES.PLAYER &&
           resolvedBody.moveDirectionY === -1 &&
           !resolvedBody.isOnGround) {
          // Не учитываем пересечение по оси Y
          correction.y = 0;
          needMinIntersectFix = false;
        }

        // Если тело для восстановления движется вниз
        // и пересечение по оси Y меньше чем пересечение по оси X
        if(resolvedBody.moveDirectionY === 1 &&
           correction.y < correction.x) {
          // Не учитываем пересечение по оси X
          correction.x = 0;
          needMinIntersectFix = false;
        }
      }

      // Если необхоидмо использовать исправление по минимальной величине
      // (не были использованые другие исправления)
      if(needMinIntersectFix) {
        // Если пересечение по оси X меньше пересечения по оси Y,
        // сбрасываем пересечение по оси Y
        if(correction.x < correction.y) correction.y = 0;
        // Иначе сбрасываем пересечение по оси X
        else correction.x = 0;
      }

      // Изменение направления вектора пересечения в зависимости от позиции
      // тела для восстановления позиции по отношению к статическому
      if(resolvedBody.position.y < staticBody.position.y) correction.y *= -1;
      if(resolvedBody.position.x < staticBody.position.x) correction.x *= -1;

      // Обновление тела с учетом вектора корректировки
      resolvedBody.updateCollision(correction);
      // Восстановление позиций
      resolvedBody.setPosition({
        x: resolvedBody.position.x + correction.x,
        y: resolvedBody.position.y + correction.y
      });
    }
  };

  /**
   * Вспомогательные действия после обновления физического мира
   *
   * @param  {Array}  bodies  Список тел физического мира
   */
  const afterUpdate = bodies => {
    // Проход по телам
    for(let i = 0, l = bodies.length; i < l; i++) {
      const body = bodies[i];

      // Если под телом игрока нет платформ
      // и не установлены таймеры прыжка и падения
      if(body.type === BODIES_TYPES.PLAYER &&
         !body.isOnGround &&
         body.jumpTimer === false &&
         body.fallTimer === false) {
        // Устанавливаем таймер падения и последнюю позицию на земле
        body.fallTimer = 0;
        body.lastGroundPositionY = body.position.y;
      }
    }
  };

  // Импорт класса сетки

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

  /**
   * Обертка для создания физического мира
   *
   * @param   {Object}  options  Параметры конструктора физического мира
   * @return  {World}            Экземпляр класса физического мира
   */
  const createWorld = options => {
    return new World(options);
  };

  return createWorld;

}());
