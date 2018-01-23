﻿const EventEmitter = require('events');
const Ghosts = require('./ghosts');
const AllRiders = require('./allRiders');
const Events = require('./events');

const MAX_RIDERS = 40;

const GROUP_COLOURS = [
  'red',
  'green',
  'blue',
  'yellow'
];

const EVENTID_PREFIX = "eventid:";

class Rider extends EventEmitter {
  constructor(account, riderId, riderStatusFn) {
    super();

    this.account = account;
    this.allRiders = new AllRiders(account);
    this.events = new Events(account);
    this.riderId = riderId;
    this.ghosts = new Ghosts(account, riderId);
    this.riderStatusFn = riderStatusFn || this.fallbackRiderStatusFn
    this.worldId = undefined;
    this.statusWorldId = undefined;
    this.filter = undefined;
  }

  setRiderId(riderId, riderStatusFn) {
    this.riderId = riderId;
    this.riderStatusFn = riderStatusFn || this.fallbackRiderStatusFn
  }

  setWorld(worldId) {
    if (this.worldId !== worldId) {
      this.worldId = worldId;
      this.emit('world', this.worldId);
    }
  }

  getWorld() {
    return this.worldId;
  }

  setFilter(filter) {
    if (this.filter !== filter) {
      this.filter = filter;
      this.ridingNow = null;
    }
  }

  getFilter() {
    return this.filter;
  }

  getCurrentWorld() {
    return this.worldId || this.statusWorldId;
  }

  pollPositions() {
    this.getPositions()
      .then(positions => {
        this.emit('positions', positions);
      })
      .catch(err => {
        console.error(err);
      });
  }

  getGhosts() {
    return this.ghosts;
  }

  regroupGhosts() {
    return this.getPositions().then(positions => {
      if (positions.length > 0) {
        return this.getGhosts().regroup(positions[0]);
      }
			return []
    })
  }

  getProfile() {
    return this.account.getProfile(this.riderId).profile();
  }

  getRiders() {
    return this.getProfile().then(profile => {
      profile.me = true;
      return this.getFriends(profile.id).then(friends => {
        return [profile].concat(friends.map(this.friendMap));
      });
		});
  }

	getFriends(riderId) {
		return this.account.getProfile(riderId).followees();
	}

  getActivities(worldId, riderId) {
    const matchWorld = parseInt(worldId);
    return this.account.getProfile(riderId).activities(0, 30)
      .then(activities => {
				return activities.filter(a => a.worldId === matchWorld);
      });
  }

  getRidingNow() {
    const cached = this.getCachedRiders();
    if (cached) {
      return Promise.resolve(cached);
    } else {
      return this.requestRidingNow().then(riders => {
        this.ridingNow = riders;
        this.ridingNowDate = new Date();
        return riders;
      });
    }
  }

  getCachedRiders() {
    if (this.ridingNow && (new Date() - this.ridingNowDate < 30000)) {
      return this.ridingNow;
    }
    return null;
  }

  requestRidingNow() {
    // return this.requestRidingEvent();
    return this.filter
      ? this.requestRidingFiltered()
      : this.requestRidingFriends();
  }

  requestRidingFriends() {
    return Promise.all([
      this.allRiders.get(),
      this.getRiders()
    ]).then(([worldRiders, riders]) =>
      riders.filter(r => worldRiders.filter(wr => wr.playerId === r.id).length > 0)
    );
  }

  requestRidingFiltered() {
    if (this.filter.indexOf(EVENTID_PREFIX) === 0) {
      const eventId = parseInt(this.filter.substring(EVENTID_PREFIX.length));
      return this.requestRidingEvent(eventId);
    } else {
      return this.requestRidingFilterName();
    }
  }

  requestRidingFilterName() {
    return this.allRiders.get()
      .then(worldRiders =>
        worldRiders
          .filter(r => this.filterWorldRider(r))
          .map(r => this.mapWorldRider(r))
    );
  }

  requestRidingEvent(eventId) {
    return this.events.getEvents().then(events => {
      const event = events.find(e => e.id === eventId);

      return Promise.all(
        event.eventSubgroups.map(g => this.getSubgroupRiders(g.id, g.label))
      ).then(groupedRiders => {
        const allRiders = [].concat.apply([], groupedRiders);

        const meGroup = allRiders.find(r => r.id === this.riderId);
        if (meGroup) {
          allRiders.sort((a, b) => Math.abs(a.group - meGroup.group) - Math.abs(b.group - meGroup.group));
        }

        return allRiders;
      });
    });
  }

  getSubgroupRiders(subGroupId, label) {
    return this.events.getRiders(subGroupId)
      .then(riders => riders.map(r => Object.assign({}, r, {
        me: r.id === this.riderId,
        group: label
      })));
  }

  filterWorldRider(rider) {
    const fullName = `${rider.firstName ? rider.firstName : ''} ${rider.lastName ? rider.lastName: ''}`;
    return fullName.toLowerCase().indexOf(this.filter) !== -1;
  }

  mapWorldRider(rider) {
    return {
      id: rider.playerId,
      me: rider.playerId === this.riderId,
      firstName: rider.firstName,
      lastName: rider.lastName,
      male: rider.male,
      playerType: rider.playerType,
      countryCode: rider.countryISOCode
    };
  }

  friendMap(friend) {
    return friend.followeeProfile;
  }

  getPositions() {
		// id, firstName, lastName
    return this.getRidingNow().then(riders => {
      const promises = riders
          .slice(0, MAX_RIDERS)
          .map(r => this.riderPromise(r));

      return Promise.all(promises)
        .then(positions => this.filterByWorld(positions))
        .then(positions => this.addGhosts(positions.filter(p => p !== null)));
    });
  }

  riderPromise(rider) {
    return this.riderStatusFn(rider.id)
      .then(status => {
        if (status) {
          return {
            id: rider.id,
            me: rider.me,
            world: status.world,
            firstName: rider.firstName,
            lastName: rider.lastName,
            distance: status.distance,
            speed: status.speed,
            power: status.power,
            time: status.time,
            climbing: status.climbing,
            x: status.x,
            y: status.y,
            altitude: status.altitude,
            heartrate: status.heartrate,
            wattsPerKG: status.wattsPerKG,
            roadID: status.roadID,
            rideOns: status.rideOns,
            isTurning: status.isTurning,
            isForward: status.isForward,
            roadDirection: status.roadDirection,
            turnSignal: status.turnSignal,
            powerup: status.powerup,
            hasFeatherBoost: status.hasFeatherBoost,
            hasDraftBoost: status.hasDraftBoost,
            hasAeroBoost: status.hasAeroBoost,
            sport: status.sport,
            male: rider.male,
            playerType: rider.playerType,
            contryAlpha3: rider.countryAlpha3,
            countryCode: rider.countryCode,
            weight: rider.weight,
            colour: this.colourFromGroup(rider.group)
          };
        } else {
          return null;
        }
      });
  }

  colourFromGroup(group) {
    return group ? GROUP_COLOURS[group-1] : undefined;
  }

  filterByWorld(positions) {
    const worldId = this.worldId || this.getWorldFromPositions(positions);
    if (worldId) {
      return positions.filter(p => p && p.world === worldId)
    } else {
      return positions;
    }
  }

  getWorldFromPositions(positions) {
    const mePosition = positions.find(p => p && p.me);
    this.statusWorldId = mePosition ? mePosition.world : undefined;
    return this.statusWorldId;
  }

  addGhosts(positions) {
    const ghostPositions = this.ghosts.getPositions();
    return positions.concat(ghostPositions);
  }

  fallbackRiderStatusFn(id) {
    return new Promise(resolve => {
      this.account.getWorld(1).riderStatus(id)
          .then(status => {
            resolve(status);
          })
          .catch(ex => {
            console.log(`Failed to get status for ${id}${errorMessage(ex)}`);
            resolve(null);
          });
    });
  }
}
module.exports = Rider;

function errorMessage(ex) {
    return (ex && ex.response && ex.response.status) ? `- ${ex.response.status} (${ex.response.statusText})` : '';
}