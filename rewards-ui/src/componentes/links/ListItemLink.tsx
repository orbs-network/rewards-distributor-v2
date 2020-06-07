// Taken from https://material-ui.com/guides/composition/#ListRouter.tsx
import React from "react";
import { Link as RouterLink, LinkProps as RouterLinkProps } from 'react-router-dom';
import {ListItem, ListItemIcon, ListItemText} from "@material-ui/core";

interface ListItemLinkProps {
    icon?: React.ReactElement;
    primary: string;
    to: string;
}

export function ListItemLink(props: ListItemLinkProps) {
    const { icon, primary, to } = props;

    const renderLink = React.useMemo(
        () =>
            React.forwardRef<any, Omit<RouterLinkProps, 'to'>>((itemProps, ref) => (
                <RouterLink to={to} ref={ref} {...itemProps} />
            )),
        [to],
    );

    return (
        <li>
            <ListItem button component={renderLink}>
                {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
                <ListItemText primary={primary} />
            </ListItem>
        </li>
    );
}
