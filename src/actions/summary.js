import axios from 'axios';

import { getStravaSettings } from './strava';

export const SET_MENU_STATE = "SET_MENU_STATE";

export function setMenuState(showMenu) {
  return {
    type: SET_MENU_STATE,
    visible: showMenu
  };
}

export const SHOW_WORLD_SELECTOR = "SHOW_WORLD_SELECTOR";

export function showWorldSelector(showSelector) {
  return {
    type: SHOW_WORLD_SELECTOR,
    visible: showSelector
  };
}

export function setWorld(worldId) {
  return dispatch => {
    axios.post(`/world`, { world: worldId })
      .then(() => {
        dispatch(showWorldSelector(false));
      })
      .catch(error => {
        if (error.response) {
          const { status, statusMessage } = error.response;
          console.error(`Error setting world : ${status} - ${statusMessage}`);
        } else {
          console.error(error);
        }
      })
  }
}

export const SHOW_STRAVA_SETTINGS = "SHOW_STRAVA_SETTINGS";

export function showStravaSettings(showStrava) {
  return dispatch => {
    if (showStrava) {
      dispatch(getStravaSettings());
    }

    dispatch({
      type: SHOW_STRAVA_SETTINGS,
      visible: showStrava
    });
  }
}

export const SHOW_RIDER_FILTER = "SHOW_RIDER_FILTER";

export function showRiderFilter(showFilter) {
  return {
    type: SHOW_RIDER_FILTER,
    visible: showFilter
  };
}

export const SET_RIDER_FILTER = "SET_RIDER_FILTER";

export function setRiderFilter(filter) {
  return dispatch => {
    dispatch({
      type: SET_RIDER_FILTER,
      filter
    });

    axios.post(`/riderfilter`, { filter })
      .then(() => {
        dispatch(showRiderFilter(false));
      })
      .catch(error => {
        if (error.response) {
          const { status, statusMessage } = error.response;
          console.error(`Error setting world : ${status} - ${statusMessage}`);
        } else {
          console.error(error);
        }
      })
  }
}

export const SET_ZOOM_LEVEL = "SET_ZOOM_LEVEL";

export function setZoomLevel(level) {
  return {
    type: SET_ZOOM_LEVEL,
    level
  };
}